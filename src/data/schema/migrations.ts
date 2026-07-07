/**
 * Versioned database migration system.
 *
 * Each migration has a numeric version, a descriptive name, and
 * SQL strings for "up" (apply) and "down" (rollback).
 *
 * The runner manages the `schema_version` table and applies
 * pending migrations in order.
 */

import type { IStorageDriver } from '../driver/types.js'
import { DriverNotOpenError } from '../driver/errors.js'

export interface Migration {
  /** Monotonically increasing version number. */
  version: number
  /** Human-readable description. */
  name: string
  /** SQL statements to apply this migration. */
  up: string
  /** SQL statements to rollback this migration. */
  down: string
}

/**
 * Ordered list of ALL migrations. New migrations are appended at the end.
 * The runner picks up any migration whose version > current schema_version.
 */
export class MigrationRunner {
  private driver: IStorageDriver
  private migrations: Migration[]

  constructor(driver: IStorageDriver, migrations: Migration[]) {
    if (!driver.isOpen()) throw new DriverNotOpenError('MigrationRunner')
    this.driver = driver
    // Sort ascending by version
    this.migrations = [...migrations].sort((a, b) => a.version - b.version)
    // Validate no duplicate versions
    const seen = new Set<number>()
    for (const m of this.migrations) {
      if (seen.has(m.version)) throw new Error(`Duplicate migration version: ${m.version}`)
      seen.add(m.version)
    }
  }

  /** Ensure schema_version tracking table exists (idempotent). */
  async bootstrap(): Promise<void> {
    await this.driver.exec(
      `CREATE TABLE IF NOT EXISTS schema_version (
        version    INTEGER PRIMARY KEY,
        name       TEXT    NOT NULL,
        applied_at INTEGER NOT NULL
      )`,
    )
    // Also create a registry of applied versions for tracking
    await this.driver.exec(
      `CREATE TABLE IF NOT EXISTS migration_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        version    INTEGER NOT NULL,
        name       TEXT    NOT NULL,
        direction  TEXT    NOT NULL CHECK(direction IN ('up','down')),
        applied_at INTEGER NOT NULL
      )`,
    )
  }

  /** Get the current schema version (0 if never migrated). */
  async currentVersion(): Promise<number> {
    try {
      const rows = await this.driver.query<{ version: number }>(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1',
      )
      return rows[0]?.version ?? 0
    } catch {
      return 0
    }
  }

  /**
   * Apply all pending migrations up to `targetVersion` (or latest if omitted).
   * Returns the new version.
   */
  async run(targetVersion?: number): Promise<number> {
    await this.bootstrap()
    const current = await this.currentVersion()
    const target = targetVersion ?? this.latestVersion()
    if (target === current) return current
    if (target < current) throw new Error(`Cannot migrate down. Current: ${current}, target: ${target}. Use rollback().`)

    const pending = this.migrations.filter((m) => m.version > current && m.version <= target)
    let applied = current
    for (const m of pending) {
      await this.driver.exec(m.up)
      await this.driver.exec(
        'INSERT OR REPLACE INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, Date.now()],
      )
      await this.driver.exec(
        'INSERT INTO migration_log (version, name, direction, applied_at) VALUES (?, ?, ?, ?)',
        [m.version, m.name, 'up', Date.now()],
      )
      applied = m.version
    }
    return applied
  }

  /**
   * Rollback migrations down to `targetVersion`.
   * Runs "down" SQL in reverse order for each migration > target.
   */
  async rollback(targetVersion: number): Promise<number> {
    await this.bootstrap()
    const current = await this.currentVersion()
    if (targetVersion >= current) return current

    const toRemove = this.migrations
      .filter((m) => m.version > targetVersion && m.version <= current)
      .reverse() // newest first
    let newVersion = current
    for (const m of toRemove) {
      await this.driver.exec(m.down)
      await this.driver.exec('DELETE FROM schema_version WHERE version = ?', [m.version])
      await this.driver.exec(
        'INSERT INTO migration_log (version, name, direction, applied_at) VALUES (?, ?, ?, ?)',
        [m.version, m.name, 'down', Date.now()],
      )
      newVersion = targetVersion
    }
    return newVersion
  }

  /** Highest migration version available. */
  latestVersion(): number {
    if (this.migrations.length === 0) return 0
    return this.migrations[this.migrations.length - 1].version
  }

  /** List all migrations with their applied status. */
  async status(): Promise<{ version: number; name: string; applied: boolean }[]> {
    const current = await this.currentVersion()
    return this.migrations.map((m) => ({
      version: m.version,
      name: m.name,
      applied: m.version <= current,
    }))
  }
}
