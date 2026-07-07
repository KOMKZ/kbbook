import type { IStorageDriver } from '../driver/types.js'
import type { BackupMeta, RestoreReport, VerifyResult } from './types.js'
import { sha256, verifyChecksum } from './checksum.js'
import { WebBackupStorage } from './storage.js'
import { exportDatabase, importDatabase, summariseDump } from '../migration/exporter.js'
import { createDriver } from '../driver/factory.js'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class BackupManager {
  private storage: WebBackupStorage

  constructor(storage?: WebBackupStorage) {
    this.storage = storage ?? new WebBackupStorage()
  }

  /**
   * Create a backup of the current database state.
   */
  async createBackup(
    driver: IStorageDriver,
    type: BackupMeta['type'] = 'manual',
    label?: string,
  ): Promise<BackupMeta> {
    const dump = await exportDatabase(driver)
    const summary = summariseDump(dump)
    const json = JSON.stringify(dump)
    const checksum = await sha256(json)
    const sizeBytes = new TextEncoder().encode(json).length

    const meta: BackupMeta = {
      id: `${type}-${generateId()}`,
      type,
      createdAt: Date.now(),
      schemaVersion: dump.schemaVersion,
      driverType: dump.driverType,
      tableCount: summary.tableCount,
      totalRows: summary.totalRows,
      checksum,
      sizeBytes,
      label,
    }

    this.storage.addBackup(meta, dump)

    // Clean up old auto backups
    if (type === 'auto') {
      this.storage.cleanupAutoBackups(5)
    }

    return meta
  }

  /**
   * Restore from a specific backup.
   * Automatically creates a pre-restore snapshot first.
   */
  async restoreFromBackup(
    driver: IStorageDriver,
    backupId: string,
  ): Promise<RestoreReport> {
    const started = Date.now()

    // Find backup meta
    const backups = this.storage.listBackups()
    const meta = backups.find((b) => b.id === backupId)
    if (!meta) {
      return { success: false, backupId, tablesRestored: 0, rowsRestored: 0, preRestoreSnapshotId: '', durationMs: Date.now() - started, error: 'Backup not found' }
    }

    // Verify integrity
    const dump = this.storage.readBackup(backupId)
    if (!dump) {
      return { success: false, backupId, tablesRestored: 0, rowsRestored: 0, preRestoreSnapshotId: '', durationMs: Date.now() - started, error: 'Backup data not found' }
    }

    const verify = await this.verifyBackup(backupId)
    if (!verify.valid) {
      return { success: false, backupId, tablesRestored: 0, rowsRestored: 0, preRestoreSnapshotId: '', durationMs: Date.now() - started, error: verify.error ?? 'Backup verification failed' }
    }

    // Create pre-restore snapshot (safety net)
    const preSnapshot = await this.createBackup(driver, 'pre-migration', `auto-before-restore-${backupId}`)

    // Execute restore
    try {
      await importDatabase(driver, dump)
      const summary = summariseDump(dump)

      return {
        success: true,
        backupId,
        tablesRestored: summary.tableCount,
        rowsRestored: summary.totalRows,
        preRestoreSnapshotId: preSnapshot.id,
        durationMs: Date.now() - started,
      }
    } catch (err) {
      return {
        success: false,
        backupId,
        tablesRestored: 0,
        rowsRestored: 0,
        preRestoreSnapshotId: preSnapshot.id,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Verify a backup's integrity and recoverability.
   * Performs checksum validation + dry-run import to temp driver.
   */
  async verifyBackup(backupId: string): Promise<VerifyResult> {
    const dump = this.storage.readBackup(backupId)
    if (!dump) {
      return { valid: false, checksumMatch: false, dryRunRows: 0, schemaCompatible: false, error: 'Backup data not found' }
    }

    // Checksum
    const meta = this.storage.listBackups().find((b) => b.id === backupId)
    const json = JSON.stringify(dump)
    const checksumMatch = meta ? await verifyChecksum(json, meta.checksum) : false
    if (!checksumMatch) {
      return { valid: false, checksumMatch: false, dryRunRows: 0, schemaCompatible: true, error: 'Checksum mismatch — backup may be corrupted' }
    }

    // Dry-run import to temp in-memory driver
    try {
      const tempDriver = createDriver('sqljs')
      await tempDriver.open()
      try {
        await importDatabase(tempDriver, dump)
        const summary = summariseDump(dump)
        await tempDriver.close()
        return { valid: true, checksumMatch: true, dryRunRows: summary.totalRows, schemaCompatible: true }
      } catch {
        await tempDriver.close()
        return { valid: false, checksumMatch: true, dryRunRows: 0, schemaCompatible: false, error: 'Dry-run import failed — schema may be incompatible' }
      }
    } catch {
      return { valid: false, checksumMatch: true, dryRunRows: 0, schemaCompatible: false, error: 'Unable to create temp driver for dry-run' }
    }
  }

  listBackups(): BackupMeta[] {
    return this.storage.listBackups()
  }

  deleteBackup(backupId: string): void {
    this.storage.removeBackup(backupId)
  }

  /** Keep only the most recent `keep` auto backups. */
  cleanupAutoBackups(keep = 5): BackupMeta[] {
    return this.storage.cleanupAutoBackups(keep)
  }

  /** Get total backup storage size in bytes. */
  totalSize(): number {
    return this.storage.totalSize()
  }
}
