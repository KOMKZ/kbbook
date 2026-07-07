/**
 * LocalStorageDriver — IStorageDriver implementation using localStorage.
 *
 * Supports a useful subset of SQL for basic CRUD (INSERT, UPDATE, DELETE, SELECT,
 * CREATE TABLE, DROP TABLE). Complex operations (JOIN, subquery, aggregate) throw
 * UnsupportedQueryError.
 *
 * Storage model:
 *   kbbook-db:table:<name>  → JSON array of row objects
 *   kbbook-db:meta:__tables → JSON array of registered table names
 */

import type { IStorageDriver, BindValue, ExecResult, DatabaseDump } from './types.js'
import { DriverNotOpenError, UnsupportedQueryError } from './errors.js'

const PREFIX = 'kbbook-db:'
const TABLE_PREFIX = `${PREFIX}table:`
const TABLES_REGISTRY_KEY = `${PREFIX}meta:__tables`

// ── SQL Parsing (minimal regex-based) ────────────────────────────────────────

interface ParsedStmt {
  type: 'create' | 'drop' | 'insert' | 'update' | 'delete' | 'select'
  table: string
  columns?: string[]
  values?: string[]       // placeholder positions or literal tokens
  setClauses?: [string, string][]  // [col, placeholder]
  whereCol?: string
  whereVal?: string
  trailing?: string       // ORDER BY / LIMIT suffix (for SELECT)
}

/**
 * Strip trailing clauses (ORDER BY, LIMIT) from SQL to simplify regex matching,
 * but preserve them for the query method to consume.
 */
function stripTrailing(sql: string): { core: string; trailing: string } {
  const m = sql.match(/^(.+?)\s+(ORDER\s+BY\s+.+|LIMIT\s+.+)$/i)
  if (m) return { core: m[1].trim(), trailing: m[2].trim() }
  return { core: sql.trim(), trailing: '' }
}

function parseSql(originalSql: string): ParsedStmt {
  const { core: s, trailing } = stripTrailing(originalSql)

  // CREATE TABLE [IF NOT EXISTS] name (...)
  const createM = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/i)
  if (createM) return { type: 'create', table: createM[1] }

  // DROP TABLE [IF EXISTS] name
  const dropM = s.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)
  if (dropM) return { type: 'drop', table: dropM[1] }

  // INSERT INTO name (col1, col2, ...) VALUES (?, ?, ...)
  const insertM = s.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
  if (insertM) {
    const columns = insertM[2].split(',').map((c) => c.trim())
    const values = insertM[3].split(',').map((v) => v.trim())
    return { type: 'insert', table: insertM[1], columns, values }
  }

  // UPDATE name SET col = ?, col2 = ? WHERE col = ?
  const updateM = s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(\w+)\s*=\s*\?/i)
  if (updateM) {
    const setClauses: [string, string][] = []
    const setStr = updateM[2]
    const parts = setStr.split(/\s*,\s*(?=\w+\s*=)/)
    for (const part of parts) {
      const m = part.match(/^(\w+)\s*=\s*(\S+)/)
      if (m) setClauses.push([m[1], m[2]])
    }
    return { type: 'update', table: updateM[1], setClauses, whereCol: updateM[3] }
  }

  // DELETE FROM name WHERE col = ?
  const deleteM = s.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i)
  if (deleteM) return { type: 'delete', table: deleteM[1], whereCol: deleteM[2] }

  // SELECT * FROM name
  const selectAllM = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s*$/i)
  if (selectAllM) return { type: 'select', table: selectAllM[1], trailing }

  // SELECT * FROM name WHERE col = ?
  const selectWhereM = s.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i)
  if (selectWhereM) return { type: 'select', table: selectWhereM[1], whereCol: selectWhereM[2], trailing }

  throw new UnsupportedQueryError('localstorage', originalSql)
}

// ── Driver ───────────────────────────────────────────────────────────────────

export class LocalStorageDriver implements IStorageDriver {
  readonly type = 'localstorage'
  private _open = false
  /** In-memory cache of which tables exist (populated from localStorage on open). */
  private _tables: Set<string> = new Set()

  async open(): Promise<void> {
    this._open = true
    // Restore table registry from persistent storage
    this._tables = this.readTableRegistry()
  }

  async close(): Promise<void> {
    this._open = false
  }

  isOpen(): boolean {
    return this._open
  }

  async exec(sql: string, params?: BindValue[]): Promise<ExecResult> {
    this.ensureOpen()
    const stmt = parseSql(sql)
    const p = (idx: number) => params?.[idx] != null ? String(params[idx]) : undefined

    switch (stmt.type) {
      case 'create': {
        const key = TABLE_PREFIX + stmt.table
        if (!this._tables.has(stmt.table)) {
          this._tables.add(stmt.table)
          localStorage.setItem(key, '[]')
          this.writeTableRegistry()
        }
        return { changes: 0 }
      }

      case 'drop': {
        const key = TABLE_PREFIX + stmt.table
        if (this._tables.has(stmt.table)) {
          this._tables.delete(stmt.table)
          localStorage.removeItem(key)
          this.writeTableRegistry()
          return { changes: 1 }
        }
        return { changes: 0 }
      }

      case 'insert': {
        this.checkTable(stmt.table)
        const rows = this.readTable(stmt.table)
        const row: Record<string, unknown> = {}
        if (stmt.columns && stmt.values) {
          for (let i = 0; i < stmt.columns.length; i++) {
            const val = stmt.values[i] === '?' ? p(i) ?? null : stmt.values[i]
            row[stmt.columns[i]] = this.coerce(val)
          }
        }
        rows.push(row)
        this.writeTable(stmt.table, rows)
        return { changes: 1, lastInsertRowid: rows.length }
      }

      case 'update': {
        this.checkTable(stmt.table)
        const rows = this.readTable(stmt.table)
        if (!stmt.whereCol || !stmt.setClauses) break
        // WHERE param is the LAST ? — after all SET params
        const whereParamIdx = stmt.setClauses.filter(([, v]) => v === '?').length
        const whereVal = p(whereParamIdx)
        let changes = 0
        for (const row of rows) {
          if (String(row[stmt.whereCol]) === whereVal) {
            for (let i = 0; i < stmt.setClauses.length; i++) {
              const [col] = stmt.setClauses[i]
              const tmpl = stmt.setClauses[i][1]
              const val = tmpl === '?' ? p(i) : tmpl
              row[col] = this.coerce(val)
            }
            changes++
          }
        }
        if (changes > 0) this.writeTable(stmt.table, rows)
        return { changes }
      }

      case 'delete': {
        this.checkTable(stmt.table)
        const rows = this.readTable(stmt.table)
        if (!stmt.whereCol) break
        const whereVal = p(0)
        const keep = rows.filter((r) => String(r[stmt.whereCol!]) !== whereVal)
        const changes = rows.length - keep.length
        if (changes > 0) this.writeTable(stmt.table, keep)
        return { changes }
      }

      default:
        break
    }

    return { changes: 0 }
  }

  async query<T = Record<string, unknown>>(sql: string, params?: BindValue[]): Promise<T[]> {
    this.ensureOpen()
    const stmt = parseSql(sql)
    const p = (idx: number) => params?.[idx] != null ? String(params[idx]) : undefined

    if (stmt.type !== 'select') {
      throw new UnsupportedQueryError('localstorage', sql)
    }

    this.checkTable(stmt.table)
    let rows = this.readTable(stmt.table)

    // WHERE filter
    if (stmt.whereCol && params && params.length > 0) {
      const whereVal = p(0)
      rows = rows.filter((r) => String(r[stmt.whereCol!]) === whereVal)
    }

    // ORDER BY (from trailing clause)
    const trail = stmt.trailing || ''
    const orderMatch = trail.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i)
    if (orderMatch) {
      const col = orderMatch[1]
      const dir = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1
      rows.sort((a, b) => {
        const va = a[col], vb = b[col]
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
        return String(va).localeCompare(String(vb)) * dir
      })
    }

    const limitMatch = trail.match(/LIMIT\s+(\d+)/i)
    if (limitMatch) {
      rows = rows.slice(0, parseInt(limitMatch[1]))
    }

    return rows as unknown as T[]
  }

  async export(): Promise<DatabaseDump> {
    this.ensureOpen()
    const tables: Record<string, Record<string, unknown>[]> = {}
    for (const name of this._tables) {
      const key = TABLE_PREFIX + name
      const raw = localStorage.getItem(key)
      if (raw != null) {
        try { tables[name] = JSON.parse(raw) } catch { tables[name] = [] }
      }
    }
    return {
      version: 1,
      exportedAt: Date.now(),
      driverType: this.type,
      schemaVersion: 0,
      tables,
    }
  }

  async import(dump: DatabaseDump): Promise<void> {
    this.ensureOpen()
    // Clear existing data
    for (const name of this._tables) {
      localStorage.removeItem(TABLE_PREFIX + name)
    }
    this._tables.clear()
    // Write imported data
    for (const [name, rows] of Object.entries(dump.tables)) {
      this._tables.add(name)
      localStorage.setItem(TABLE_PREFIX + name, JSON.stringify(rows))
    }
    this.writeTableRegistry()
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private ensureOpen(): void {
    if (!this._open) throw new DriverNotOpenError(this.type)
  }

  private checkTable(name: string): void {
    if (!this._tables.has(name)) {
      throw new UnsupportedQueryError(this.type, `table "${name}" does not exist`)
    }
  }

  private readTable(name: string): Record<string, unknown>[] {
    const raw = localStorage.getItem(TABLE_PREFIX + name)
    if (raw == null) return []
    try { return JSON.parse(raw) } catch { return [] }
  }

  private writeTable(name: string, rows: Record<string, unknown>[]): void {
    try {
      localStorage.setItem(TABLE_PREFIX + name, JSON.stringify(rows))
    } catch {
      // quota exceeded or privacy mode — silently fail
    }
  }

  private readTableRegistry(): Set<string> {
    try {
      const raw = localStorage.getItem(TABLES_REGISTRY_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  }

  private writeTableRegistry(): void {
    try {
      localStorage.setItem(TABLES_REGISTRY_KEY, JSON.stringify([...this._tables]))
    } catch {}
  }

  private coerce(val: unknown): unknown {
    if (val === 'NULL' || val === null || val === undefined) return null
    if (typeof val === 'string') {
      const n = Number(val)
      if (!isNaN(n) && val.trim() !== '') return n
    }
    return val
  }
}
