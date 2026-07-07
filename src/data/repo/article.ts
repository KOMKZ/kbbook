import type { IStorageDriver, BindValue } from '../driver/types.js'
import type { Article, ArticleCreate, ArticleUpdate } from './types.js'

const COLUMNS = 'slug, series_id, group_id, title, description, content, word_count, read_time_mins, status, tags, frontmatter, created_at, updated_at'

function rowToArticle(r: Record<string, unknown>): Article {
  return {
    slug: r.slug as string,
    seriesId: r.series_id as string,
    groupId: (r.group_id as string) ?? null,
    title: r.title as string,
    description: (r.description as string) ?? null,
    content: (r.content as string) ?? null,
    wordCount: (r.word_count as number) ?? 0,
    readTimeMins: (r.read_time_mins as number) ?? 0,
    status: (r.status as Article['status']) ?? 'published',
    tags: (r.tags as string) ?? null,
    frontmatter: (r.frontmatter as string) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

export class ArticleRepo {
  constructor(private db: IStorageDriver) {}

  async create(input: ArticleCreate): Promise<Article> {
    const now = Date.now()
    await this.db.exec(
      `INSERT INTO articles (slug, series_id, group_id, title, description, content, word_count, read_time_mins, status, tags, frontmatter, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug, input.seriesId, input.groupId ?? null, input.title,
        input.description ?? null, input.content ?? null,
        input.wordCount ?? 0, input.readTimeMins ?? 0,
        input.status ?? 'published', input.tags ?? null, input.frontmatter ?? null,
        now, now,
      ],
    )
    return (await this.findBySlug(input.slug))!
  }

  async update(slug: string, input: ArticleUpdate): Promise<void> {
    const sets: string[] = []
    const vals: BindValue[] = []
    for (const [k, v] of Object.entries(input)) {
      const col = camelToSnake(k)
      sets.push(`${col} = ?`)
      vals.push((v ?? null) as BindValue)
    }
    if (!sets.length) return
    sets.push('updated_at = ?')
    vals.push(Date.now())
    vals.push(slug)
    await this.db.exec(`UPDATE articles SET ${sets.join(', ')} WHERE slug = ?`, vals)
  }

  async delete(slug: string): Promise<void> {
    await this.db.exec('DELETE FROM articles WHERE slug = ?', [slug])
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT ${COLUMNS} FROM articles WHERE slug = ?`, [slug])
    return rows.length ? rowToArticle(rows[0]) : null
  }

  async findBySeries(seriesId: string): Promise<Article[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM articles WHERE series_id = ? ORDER BY created_at DESC`,
      [seriesId],
    )
    return rows.map(rowToArticle)
  }

  async findByGroup(groupId: string): Promise<Article[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM articles WHERE group_id = ? ORDER BY created_at DESC`,
      [groupId],
    )
    return rows.map(rowToArticle)
  }

  async search(query: string): Promise<Article[]> {
    const pattern = `%${query}%`
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM articles WHERE title LIKE ? OR description LIKE ? ORDER BY updated_at DESC LIMIT 50`,
      [pattern, pattern],
    )
    return rows.map(rowToArticle)
  }

  async countBySeries(seriesId: string): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM articles WHERE series_id = ?',
      [seriesId],
    )
    return rows[0]?.cnt ?? 0
  }

  async countByGroup(groupId: string): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM articles WHERE group_id = ?',
      [groupId],
    )
    return rows[0]?.cnt ?? 0
  }
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
}
