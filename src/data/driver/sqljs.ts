/**
 * SqlJsDriver — IStorageDriver implementation using sql.js (SQLite compiled to WASM).
 *
 * Targets web browsers. Persists the database to OPFS when available,
 * falling back to in-memory-only mode.
 *
 * In Node (vitest): loads WASM binary directly from node_modules via createRequire.
 * In browser: loads WASM from CDN via locateFile.
 */

import type { IStorageDriver, BindValue, ExecResult, DatabaseDump } from './types.js'
import { DriverNotOpenError } from './errors.js'
import type SqlJs from 'sql.js'

const DB_FILE = 'kbbsqllite.db'

export class SqlJsDriver implements IStorageDriver {
  readonly type = 'sqljs'
  private _open = false
  private _db: SqlJs.Database | null = null
  private _SQL: SqlJs.SqlJsStatic | null = null
  private _inMemoryOnly = false

  async open(): Promise<void> {
    const initSqlJs = (await import('sql.js')).default

    // Resolve WASM: load binary directly in Node, use CDN in browser
    const sqlConfig: Record<string, unknown> = {}
    try {
      const { readFileSync } = await import('node:fs')
      const { createRequire } = await import('node:module')
      const req = createRequire(import.meta.url)
      sqlConfig.wasmBinary = readFileSync(req.resolve('sql.js/dist/sql-wasm.wasm'))
    } catch {
      // Browser fallback
      sqlConfig.locateFile = (file: string) =>
        `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`
    }

    this._SQL = await initSqlJs(sqlConfig)

    let data: Uint8Array | undefined

    // Try loading from OPFS (browser persistent storage)
    if (typeof globalThis.navigator?.storage?.getDirectory === 'function') {
      try {
        const dir = await globalThis.navigator.storage.getDirectory()
        const fh = await dir.getFileHandle(DB_FILE, { create: true })
        const file = await fh.getFile()
        const buf = await file.arrayBuffer()
        if (buf.byteLength > 0) {
          data = new Uint8Array(buf)
        }
      } catch {
        this._inMemoryOnly = true
      }
    } else {
      this._inMemoryOnly = true
    }

    this._db = new this._SQL.Database(data)
    this._open = true
  }

  async close(): Promise<void> {
    if (!this._open || !this._db) return
    await this.persistToOPFS()
    this._db.close()
    this._db = null
    this._open = false
  }

  isOpen(): boolean {
    return this._open
  }

  async exec(sql: string, params?: BindValue[]): Promise<ExecResult> {
    this.ensureOpen()
    this._db!.run(sql, this.toBindParams(params))

    // sql.js db.run() doesn't return row counts — query them via SQLite builtins
    const changesResult = this._db!.exec('SELECT changes() as c')
    const changes = (changesResult[0]?.values[0][0] as number) ?? 0
    const idResult = this._db!.exec('SELECT last_insert_rowid() as id')
    const lastInsertRowid = (idResult[0]?.values[0][0] as number) ?? undefined

    await this.persistToOPFS()
    return { changes, lastInsertRowid }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: BindValue[]): Promise<T[]> {
    this.ensureOpen()
    const results = this._db!.exec(sql, this.toBindParams(params))
    if (!results.length) return []

    const rows: T[] = []
    for (const result of results) {
      const { columns, values } = result
      for (const valueRow of values) {
        const row: Record<string, unknown> = {}
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = valueRow[i]
        }
        rows.push(row as unknown as T)
      }
    }
    return rows
  }

  async export(): Promise<DatabaseDump> {
    this.ensureOpen()

    const tableRows = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    const tables: Record<string, Record<string, unknown>[]> = {}
    for (const { name } of tableRows) {
      tables[name] = await this.query(`SELECT * FROM "${name}"`)
    }

    let schemaVersion = 0
    try {
      const versionRows = await this.query<{ version: number }>(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1',
      )
      schemaVersion = versionRows[0]?.version ?? 0
    } catch {
      // schema_version table doesn't exist yet (pre-migration)
    }

    return {
      version: 1,
      exportedAt: Date.now(),
      driverType: this.type,
      schemaVersion,
      tables,
    }
  }

  async import(dump: DatabaseDump): Promise<void> {
    this.ensureOpen()

    // Clear all existing user tables
    const existing = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    for (const { name } of existing) {
      this._db!.run(`DROP TABLE IF EXISTS "${name}"`)
    }

    // Recreate from dump
    for (const [tableName, rows] of Object.entries(dump.tables)) {
      if (!rows.length) continue
      const columns = Object.keys(rows[0])
      const colDefs = columns.map((c) => {
        const sample = rows[0][c]
        return `"${c}" ${typeof sample === 'number' ? 'REAL' : 'TEXT'}`
      }).join(', ')
      this._db!.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`)
      for (const row of rows) {
        const vals = columns.map((c) => row[c])
        const placeholders = vals.map(() => '?').join(', ')
        this._db!.run(
          `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
          vals as BindValue[],
        )
      }
    }
    await this.persistToOPFS()
  }

  /** Return true if OPFS is available and being used for persistence. */
  get persistent(): boolean {
    return !this._inMemoryOnly
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private ensureOpen(): void {
    if (!this._open || !this._db) throw new DriverNotOpenError(this.type)
  }

  private toBindParams(params?: BindValue[]): any[] | undefined {
    if (!params || params.length === 0) return undefined
    return params.map((v) => (v instanceof Uint8Array ? v : v))
  }

  private async persistToOPFS(): Promise<void> {
    if (this._inMemoryOnly || !this._db) return
    try {
      const dir = await globalThis.navigator.storage.getDirectory()
      const fh = await dir.getFileHandle(DB_FILE, { create: true })
      const writable = await fh.createWritable()
      const exported = this._db.export()
      await writable.write(new Uint8Array(exported))
      await writable.close()
    } catch {
      // Silently fail — data stays in memory
    }
  }
}
