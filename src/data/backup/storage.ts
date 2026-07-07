import type { BackupMeta, BackupIndex } from './types.js'
import type { DatabaseDump } from '../driver/types.js'

const INDEX_KEY = 'kbbook-backup:index'
const DATA_PREFIX = 'kbbook-backup:data:'

export class WebBackupStorage {
  readIndex(): BackupIndex {
    try {
      const raw = localStorage.getItem(INDEX_KEY)
      return raw ? JSON.parse(raw) : { backups: [], lastCleanedAt: 0 }
    } catch {
      return { backups: [], lastCleanedAt: 0 }
    }
  }

  writeIndex(index: BackupIndex): void {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)) } catch {}
  }

  readBackup(id: string): DatabaseDump | null {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + id)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  writeBackup(id: string, dump: DatabaseDump): void {
    try { localStorage.setItem(DATA_PREFIX + id, JSON.stringify(dump)) } catch {}
  }

  deleteBackup(id: string): void {
    try { localStorage.removeItem(DATA_PREFIX + id) } catch {}
  }

  listBackups(): BackupMeta[] {
    return this.readIndex().backups
  }

  addBackup(meta: BackupMeta, dump: DatabaseDump): void {
    this.writeBackup(meta.id, dump)
    const index = this.readIndex()
    index.backups.push(meta)
    index.backups.sort((a, b) => b.createdAt - a.createdAt)
    this.writeIndex(index)
  }

  removeBackup(id: string): void {
    this.deleteBackup(id)
    const index = this.readIndex()
    index.backups = index.backups.filter((b) => b.id !== id)
    this.writeIndex(index)
  }

  /** Remove oldest auto backups, keeping at most `keep` most recent. */
  cleanupAutoBackups(keep = 5): BackupMeta[] {
    const index = this.readIndex()
    const autos = index.backups.filter((b) => b.type === 'auto')
    if (autos.length <= keep) return []
    const toRemove = autos.slice(keep) // oldest first after sorting by createdAt desc
    for (const b of toRemove) {
      this.deleteBackup(b.id)
    }
    index.backups = index.backups.filter((b) => !toRemove.includes(b))
    index.lastCleanedAt = Date.now()
    this.writeIndex(index)
    return toRemove
  }

  /** Total approximate size in bytes of all stored backups. */
  totalSize(): number {
    let size = 0
    for (const b of this.readIndex().backups) {
      size += b.sizeBytes
    }
    return size
  }
}
