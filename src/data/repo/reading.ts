import type { IStorageDriver } from '../driver/types.js'

export interface HistoryEntry {
  slug: string
  seriesId: string
  title: string
  readAt: number
}

export interface PositionEntry {
  slug: string
  seriesId: string
  version: string
  top: number
  ratio: number
  updatedAt: number
}

/**
 * Reading history — tracks which articles the user has read, most-recent first.
 */
export class ReadingHistoryRepo {
  constructor(private db: IStorageDriver) {}

  async addEntry(slug: string, seriesId: string, title: string): Promise<void> {
    // Delete existing entry for this slug first (idempotent re-read)
    await this.db.exec('DELETE FROM reading_history WHERE slug = ?', [slug])
    await this.db.exec(
      'INSERT INTO reading_history (slug, series_id, title, read_at) VALUES (?, ?, ?, ?)',
      [slug, seriesId, title, Date.now()],
    )
    // Keep at most 50 entries
    await this.db.exec(
      `DELETE FROM reading_history WHERE id NOT IN (
        SELECT id FROM reading_history ORDER BY read_at DESC LIMIT 50
      )`,
    )
  }

  async getRecent(limit = 5): Promise<HistoryEntry[]> {
    return this.db.query<{ slug: string; series_id: string; title: string; read_at: number }>(
      'SELECT slug, series_id, title, read_at FROM reading_history ORDER BY read_at DESC LIMIT ?',
      [limit],
    ).then((rows) => rows.map((r) => ({
      slug: r.slug,
      seriesId: r.series_id,
      title: r.title,
      readAt: r.read_at,
    })))
  }

  async removeEntry(slug: string): Promise<void> {
    await this.db.exec('DELETE FROM reading_history WHERE slug = ?', [slug])
  }

  async clear(): Promise<void> {
    await this.db.exec('DELETE FROM reading_history')
  }

  async count(): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM reading_history')
    return rows[0]?.cnt ?? 0
  }
}

/**
 * Reading position — remembers where the user left off in each article.
 */
export class ReadingPositionRepo {
  constructor(private db: IStorageDriver) {}

  async savePosition(slug: string, seriesId: string, version: string, top: number, ratio: number): Promise<void> {
    await this.db.exec(
      `INSERT OR REPLACE INTO reading_positions (slug, series_id, version, top, ratio, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [slug, seriesId, version, top, ratio, Date.now()],
    )
  }

  async getPosition(slug: string): Promise<PositionEntry | null> {
    const rows = await this.db.query<{
      slug: string; series_id: string; version: string; top: number; ratio: number; updated_at: number
    }>('SELECT * FROM reading_positions WHERE slug = ?', [slug])
    if (!rows.length) return null
    const r = rows[0]
    return { slug: r.slug, seriesId: r.series_id, version: r.version, top: r.top, ratio: r.ratio, updatedAt: r.updated_at }
  }

  async getAllPositions(seriesId?: string): Promise<PositionEntry[]> {
    if (seriesId) {
      return this.db.query<{ slug: string; series_id: string; version: string; top: number; ratio: number; updated_at: number }>(
        'SELECT * FROM reading_positions WHERE series_id = ? ORDER BY updated_at DESC', [seriesId],
      ).then((rows) => rows.map((r) => ({
        slug: r.slug, seriesId: r.series_id, version: r.version, top: r.top, ratio: r.ratio, updatedAt: r.updated_at,
      })))
    }
    return this.db.query<{ slug: string; series_id: string; version: string; top: number; ratio: number; updated_at: number }>(
      'SELECT * FROM reading_positions ORDER BY updated_at DESC',
    ).then((rows) => rows.map((r) => ({
      slug: r.slug, seriesId: r.series_id, version: r.version, top: r.top, ratio: r.ratio, updatedAt: r.updated_at,
    })))
  }

  async deletePosition(slug: string): Promise<void> {
    await this.db.exec('DELETE FROM reading_positions WHERE slug = ?', [slug])
  }
}
