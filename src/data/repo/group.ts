import type { IStorageDriver, BindValue } from '../driver/types.js'
import type { Group, GroupCreate, GroupUpdate } from './types.js'

const COLUMNS = 'id, series_id, parent_group_id, title, slug, sort_order'

function rowToGroup(r: Record<string, unknown>): Group {
  return {
    id: r.id as string,
    seriesId: r.series_id as string,
    parentGroupId: (r.parent_group_id as string) ?? null,
    title: r.title as string,
    slug: r.slug as string,
    sortOrder: (r.sort_order as number) ?? 0,
  }
}

export class GroupRepo {
  constructor(private db: IStorageDriver) {}

  async create(input: GroupCreate): Promise<Group> {
    // Auto-assign sort_order as max + 1 for the parent scope
    const parentCol = input.parentGroupId
      ? 'parent_group_id'
      : 'series_id'
    const parentVal = input.parentGroupId ?? input.seriesId
    const rows = await this.db.query<{ maxOrd: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) as "maxOrd" FROM groups WHERE ${parentCol} = ?`,
      [parentVal],
    )
    const sortOrder = (rows[0]?.maxOrd ?? -1) + 1

    await this.db.exec(
      `INSERT INTO groups (id, series_id, parent_group_id, title, slug, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.seriesId, input.parentGroupId ?? null, input.title, input.slug, sortOrder],
    )
    return (await this.findById(input.id))!
  }

  async update(id: string, input: GroupUpdate): Promise<void> {
    const sets: string[] = []
    const vals: BindValue[] = []
    for (const [k, v] of Object.entries(input)) {
      const col = camelToSnake(k)
      sets.push(`${col} = ?`)
      vals.push((v ?? null) as BindValue)
    }
    if (!sets.length) return
    vals.push(id)
    await this.db.exec(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`, vals)
  }

  async delete(id: string): Promise<void> {
    // Nullify children's parent reference before deleting
    await this.db.exec('UPDATE groups SET parent_group_id = NULL WHERE parent_group_id = ?', [id])
    await this.db.exec('DELETE FROM groups WHERE id = ?', [id])
  }

  async findById(id: string): Promise<Group | null> {
    const rows = await this.db.query<Record<string, unknown>>(`SELECT ${COLUMNS} FROM groups WHERE id = ?`, [id])
    return rows.length ? rowToGroup(rows[0]) : null
  }

  async findBySeries(seriesId: string): Promise<Group[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM groups WHERE series_id = ? ORDER BY sort_order`,
      [seriesId],
    )
    return rows.map(rowToGroup)
  }

  async findChildren(parentId: string): Promise<Group[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM groups WHERE parent_group_id = ? ORDER BY sort_order`,
      [parentId],
    )
    return rows.map(rowToGroup)
  }

  async findRoots(seriesId: string): Promise<Group[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${COLUMNS} FROM groups WHERE series_id = ? AND parent_group_id IS NULL ORDER BY sort_order`,
      [seriesId],
    )
    return rows.map(rowToGroup)
  }
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
}
