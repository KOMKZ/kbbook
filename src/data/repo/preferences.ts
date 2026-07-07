import type { IStorageDriver } from '../driver/types.js'

export class PreferencesRepo {
  constructor(private db: IStorageDriver) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM preferences WHERE key = ?', [key],
    )
    if (!rows.length) return null
    try { return JSON.parse(rows[0].value) as T } catch { return rows[0].value as unknown as T }
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.exec(
      'INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), Date.now()],
    )
  }

  async delete(key: string): Promise<void> {
    await this.db.exec('DELETE FROM preferences WHERE key = ?', [key])
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.db.query<{ key: string; value: string }>(
      'SELECT key, value FROM preferences',
    )
    const result: Record<string, unknown> = {}
    for (const r of rows) {
      try { result[r.key] = JSON.parse(r.value) } catch { result[r.key] = r.value }
    }
    return result
  }

  /** Get multiple keys at once — fewer round-trips. */
  async getBatch<T = unknown>(keys: string[]): Promise<Record<string, T | null>> {
    if (!keys.length) return {}
    const placeholders = keys.map(() => '?').join(', ')
    const rows = await this.db.query<{ key: string; value: string }>(
      `SELECT key, value FROM preferences WHERE key IN (${placeholders})`, keys,
    )
    const result: Record<string, T | null> = {}
    for (const k of keys) result[k] = null
    for (const r of rows) {
      try { result[r.key] = JSON.parse(r.value) as T } catch { result[r.key] = r.value as unknown as T }
    }
    return result
  }

  /** Bulk set from a map. */
  async setBatch(entries: Record<string, unknown>): Promise<void> {
    const now = Date.now()
    for (const [key, value] of Object.entries(entries)) {
      await this.db.exec(
        'INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)',
        [key, JSON.stringify(value), now],
      )
    }
  }
}
