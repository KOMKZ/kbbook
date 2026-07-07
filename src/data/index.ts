/**
 * KBBook SQLite Data Layer
 */

// Driver abstraction
export type {
  IStorageDriver,
  BindValue,
  ExecResult,
  DatabaseDump,
} from './driver/types.js'

export { DriverNotOpenError, UnsupportedQueryError } from './driver/errors.js'

export { LocalStorageDriver } from './driver/localstorage.js'
export { SqlJsDriver } from './driver/sqljs.js'

// Schema
export { MigrationRunner } from './schema/migrations.js'
export type { Migration } from './schema/migrations.js'
export { v001, allMigrations } from './schema/index.js'

// Repositories
export { SeriesRepo } from './repo/series.js'
export { GroupRepo } from './repo/group.js'
export { ArticleRepo } from './repo/article.js'
export type { Series, SeriesCreate, SeriesUpdate, Group, GroupCreate, GroupUpdate, Article, ArticleCreate, ArticleUpdate } from './repo/types.js'
export { ArticleLinkRepo } from './repo/link.js'
export type { ArticleLink, ArticleLinkCreate, LinkGraphNode, LinkGraphEdge } from './repo/link.js'
export { StatsRepo } from './repo/stats.js'
export type { SeriesStats, GlobalStats } from './repo/stats.js'

export { ReadingHistoryRepo, ReadingPositionRepo } from './repo/reading.js'
export type { HistoryEntry, PositionEntry } from './repo/reading.js'
export { AuditLogRepo } from './repo/audit.js'
export type { AuditEntry, AuditQuery } from './repo/audit.js'
export { PreferencesRepo } from './repo/preferences.js'

// Migration
export { exportDatabase, importDatabase, verifyExport, summariseDump, diffDumps } from './migration/exporter.js'
export type { ExportReport } from './migration/exporter.js'
export { switchDriver } from './migration/switcher.js'
export type { SwitchReport } from './migration/switcher.js'

// Driver factory
export { createDriver, detectAvailableDrivers } from './driver/factory.js'
export type { DriverType } from './driver/factory.js'

// Backup & Recovery
export { BackupManager } from './backup/manager.js'
export { WebBackupStorage } from './backup/storage.js'
export { sha256, verifyChecksum } from './backup/checksum.js'
export type { BackupMeta, BackupIndex, RestoreReport, VerifyResult } from './backup/types.js'
