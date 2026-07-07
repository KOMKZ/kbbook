import type { IStorageDriver, BindValue } from '../driver/types.js'
import type { Series, SeriesCreate, SeriesUpdate } from './types.js'

const COLUMNS = 'id, title, short_title, tagline, description, icon, color, version, language, enabled, sort_order, created_at, updated_at'

function rowToSeries(r: Record<string, unknown>): Series {
  return {
    id: r.id as string,
    title: r.title as string,
    shortTitle: (r.short_title as string) ?? null,
    tagline: (r.tagline as string) ?? null,
    description: (r.description as string) ?? null,
    icon: (r.icon as string) ?? null,
    color: (r.color as string) ?? null,
    version: (r.version as string) ?? null,
    language: (r.language as string) ?? null,
    enabled: !!r.enabled,
    sortOrder: (r.sort_order as number) ?? 0,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

export class SeriesRepo {
  constructor(private db: IStorageDriver) {}

  async create(input: SeriesCreate): Promise<Series> {
    const now = Date.now()
    await this.db.exec(
      `INSERT INTO series (id, title, short_title, tagline, description, icon, color, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.title, input.shortTitle ?? null, input.tagline ?? null, input.description ?? null,
       input.icon ?? null, input.color ?? null, input.enabled ? 1 : 0, input.sortOrder ?? 0, now, now],
    )
    return (await this.findById(input.id))!
  }

  async update(id: string, input: SeriesUpdate): Promise<void> {
    const sets: string[] = []
    const vals: BindValue[] = []
    for (const [k, v] of Object.entries(input)) {
      const col = camelToSnake(k)
      sets.push(`${col} = ?`)
      vals.push((k === 'enabled' ? (v ? 1 : 0) : v ?? null) as BindValue)
    }
    if (!sets.length) return
    sets.push('updated_at = ?')
    vals.push(Date.now())
    vals.push(id)
    await this.db.exec(`UPDATE series SET ${sets.join(', ')} WHERE id = ?`, vals)
  }

  async delete(id: string): Promise<void> {
    await this.db.exec('DELETE FROM series WHERE id = ?', [id])
  }

  async findById(id: string): Promise<Series | null> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT ${COLUMNS} FROM series WHERE id = ?`, [id])
    return rows.length ? rowToSeries(rows[0]) : null
  }

  async findAll(): Promise<Series[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT ${COLUMNS} FROM series ORDER BY sort_order, title`)
    return rows.map(rowToSeries)
  }

  async findEnabled(): Promise<Series[]> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT ${COLUMNS} FROM series WHERE enabled = 1 ORDER BY sort_order, title`)
    return rows.map(rowToSeries)
  }

  async count(): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM series')
    return rows[0]?.cnt ?? 0
  }

  async reorder(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.exec('UPDATE series SET sort_order = ?, updated_at = ? WHERE id = ?', [i, Date.now(), orderedIds[i]])
    }
  }
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
}
