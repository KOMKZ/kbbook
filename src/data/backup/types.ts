export interface BackupMeta {
  id: string
  type: 'pre-migration' | 'auto' | 'manual'
  createdAt: number
  schemaVersion: number
  driverType: string
  tableCount: number
  totalRows: number
  checksum: string
  sizeBytes: number
  label?: string
}

export interface BackupIndex {
  backups: BackupMeta[]
  lastCleanedAt: number
}

export interface RestoreReport {
  success: boolean
  backupId: string
  tablesRestored: number
  rowsRestored: number
  preRestoreSnapshotId: string  // backup taken just before restore
  durationMs: number
  error?: string
}

export interface VerifyResult {
  valid: boolean
  checksumMatch: boolean
  dryRunRows: number
  schemaCompatible: boolean
  error?: string
}
