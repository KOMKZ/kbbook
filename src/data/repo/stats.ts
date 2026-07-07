import type { IStorageDriver } from '../driver/types.js'

export interface SeriesStats {
  articleCount: number
  publishedCount: number
  draftCount: number
  totalWords: number
  totalReadTimeMins: number
  avgWordsPerArticle: number
  linkCount: number
}

export interface GlobalStats {
  seriesCount: number
  articleCount: number
  totalWords: number
  linkCount: number
}

export class StatsRepo {
  constructor(private db: IStorageDriver) {}

  async getSeriesStats(seriesId: string): Promise<SeriesStats> {
    const [basic] = await this.db.query<{
      article_count: number; published_count: number; draft_count: number
      total_words: number; total_read_time: number
    }>(
      `SELECT
        COUNT(*) as article_count,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        COALESCE(SUM(word_count), 0) as total_words,
        COALESCE(SUM(read_time_mins), 0) as total_read_time
      FROM articles WHERE series_id = ?`,
      [seriesId],
    )
    const [link] = await this.db.query<{ link_count: number }>(
      `SELECT COUNT(*) as link_count FROM article_links
       WHERE source_slug IN (SELECT slug FROM articles WHERE series_id = ?)
          OR target_slug IN (SELECT slug FROM articles WHERE series_id = ?)`,
      [seriesId],
    )

    const ac = basic?.article_count ?? 0
    const tw = basic?.total_words ?? 0
    return {
      articleCount: ac,
      publishedCount: basic?.published_count ?? 0,
      draftCount: basic?.draft_count ?? 0,
      totalWords: tw,
      totalReadTimeMins: basic?.total_read_time ?? 0,
      avgWordsPerArticle: ac > 0 ? Math.round(tw / ac) : 0,
      linkCount: link?.link_count ?? 0,
    }
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const [articleRow] = await this.db.query<{ cnt: number; words: number }>(
      'SELECT COUNT(*) as cnt, COALESCE(SUM(word_count), 0) as words FROM articles',
    )
    const [seriesRow] = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM series',
    )
    const [linkRow] = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM article_links',
    )
    return {
      seriesCount: seriesRow?.cnt ?? 0,
      articleCount: articleRow?.cnt ?? 0,
      totalWords: articleRow?.words ?? 0,
      linkCount: linkRow?.cnt ?? 0,
    }
  }

  /** Recompute stats and store in stats_snapshot for fast retrieval. */
  async refreshStats(seriesId?: string): Promise<void> {
    const now = Date.now()
    if (seriesId) {
      const stats = await this.getSeriesStats(seriesId)
      await this.db.exec(
        'INSERT OR REPLACE INTO stats_snapshot (key, value, computed_at) VALUES (?, ?, ?)',
        [`series:${seriesId}:stats`, JSON.stringify(stats), now],
      )
    } else {
      const global = await this.getGlobalStats()
      await this.db.exec(
        'INSERT OR REPLACE INTO stats_snapshot (key, value, computed_at) VALUES (?, ?, ?)',
        ['global:stats', JSON.stringify(global), now],
      )
    }
  }

  /** Get a previously computed snapshot. Returns null if not yet computed. */
  async getSnapshot(key: string): Promise<unknown | null> {
    const rows = await this.db.query<{ value: string }>(
      'SELECT value FROM stats_snapshot WHERE key = ?', [key],
    )
    if (!rows.length) return null
    try { return JSON.parse(rows[0].value) } catch { return null }
  }

  /** Get recent activity: most recently updated articles. */
  async getRecentActivity(days: number, limit = 10): Promise<{ slug: string; title: string; seriesId: string; updatedAt: number }[]> {
    const cutoff = Date.now() - days * 86400000
    return this.db.query(
      `SELECT slug, title, series_id as seriesId, updated_at as updatedAt
       FROM articles WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT ?`,
      [cutoff, limit],
    )
  }
}
