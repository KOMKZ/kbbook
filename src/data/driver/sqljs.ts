/**
 * SqlJsDriver — IStorageDriver implementation using sql.js (SQLite compiled to WASM).
 *
 * Node: loads WASM binary from node_modules.
 * Browser/Vite: uses ?url import so Vite bundles the WASM file.
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

    // Node: load WASM binary directly
    let sqlConfig: Record<string, unknown> | undefined
    try {
      const { readFileSync } = await import('node:fs')
      const { createRequire } = await import('node:module')
      const req = createRequire(import.meta.url)
      sqlConfig = { wasmBinary: readFileSync(req.resolve('sql.js/dist/sql-wasm.wasm')) }
    } catch {
      // Browser/Vite: use ?url import to get bundled WASM URL
      try {
        const wasm = await import('sql.js/dist/sql-wasm.wasm?url')
        sqlConfig = { locateFile: () => wasm.default }
      } catch {
        // Absolute fallback: let sql.js find it
      }
    }

    this._SQL = sqlConfig ? await initSqlJs(sqlConfig) : await initSqlJs()

    let data: Uint8Array | undefined
    if (typeof globalThis.navigator?.storage?.getDirectory === 'function') {
      try {
        const dir = await globalThis.navigator.storage.getDirectory()
        const fh = await dir.getFileHandle(DB_FILE, { create: true })
        const file = await fh.getFile()
        const buf = await file.arrayBuffer()
        if (buf.byteLength > 0) data = new Uint8Array(buf)
      } catch { this._inMemoryOnly = true }
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

  isOpen(): boolean { return this._open }

  async exec(sql: string, params?: BindValue[]): Promise<ExecResult> {
    this.ensureOpen()
    this._db!.run(sql, this.toBindParams(params))
    const cr = this._db!.exec('SELECT changes() as c')
    const changes = (cr[0]?.values[0][0] as number) ?? 0
    const ir = this._db!.exec('SELECT last_insert_rowid() as id')
    const lastInsertRowid = (ir[0]?.values[0][0] as number) ?? undefined
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
      for (const vals of values) {
        const row: Record<string, unknown> = {}
        columns.forEach((c, i) => row[c] = vals[i])
        rows.push(row as unknown as T)
      }
    }
    return rows
  }

  async export(): Promise<DatabaseDump> {
    this.ensureOpen()
    const tables: Record<string, Record<string, unknown>[]> = {}
    const tq = this._db!.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    for (const { values } of tq) {
      for (const [name] of values) {
        const data = this._db!.exec(`SELECT * FROM "${name}"`)
        if (data.length) {
          tables[name as string] = data[0].values.map(v => {
            const r: Record<string, unknown> = {}
            data[0].columns.forEach((c, i) => r[c] = v[i])
            return r
          })
        }
      }
    }
    let schemaVersion = 0
    try {
      const vr = this._db!.exec('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      schemaVersion = (vr[0]?.values[0][0] as number) ?? 0
    } catch {}
    return { version: 1, exportedAt: Date.now(), driverType: this.type, schemaVersion, tables }
  }

  async import(dump: DatabaseDump): Promise<void> {
    this.ensureOpen()
    for (const [tname, rows] of Object.entries(dump.tables)) {
      if (!rows.length) continue
      const cols = Object.keys(rows[0])
      const colDefs = cols.map(c => `"${c}" ${typeof rows[0][c] === 'number' ? 'REAL' : 'TEXT'}`).join(',')
      this._db!.run(`CREATE TABLE IF NOT EXISTS "${tname}" (${colDefs})`)
      for (const row of rows) {
        const vals = cols.map(c => row[c])
        const ph = vals.map(() => '?').join(',')
        this._db!.run(`INSERT OR IGNORE INTO "${tname}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${ph})`, vals as BindValue[])
      }
    }
    await this.persistToOPFS()
  }

  get persistent(): boolean { return !this._inMemoryOnly }

  private ensureOpen(): void {
    if (!this._open || !this._db) throw new DriverNotOpenError(this.type)
  }

  private toBindParams(params?: BindValue[]): any[] | undefined {
    if (!params?.length) return undefined
    return params.map(v => v instanceof Uint8Array ? v : v)
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
    } catch {}
  }
}
