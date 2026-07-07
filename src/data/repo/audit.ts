import type { IStorageDriver } from '../driver/types.js'

export interface AuditEntry {
  id: number
  operation: string
  entityType: string
  entityId?: string | null
  changes?: string | null // JSON diff
  source: 'llm' | 'manual' | 'sync'
  createdAt: number
}

export interface AuditQuery {
  entityType?: string
  entityId?: string
  source?: AuditEntry['source']
  limit?: number
  offset?: number
}

export class AuditLogRepo {
  constructor(private db: IStorageDriver) {}

  async log(
    operation: string,
    entityType: string,
    entityId?: string | null,
    changes?: unknown,
    source: AuditEntry['source'] = 'manual',
  ): Promise<number> {
    const result = await this.db.exec(
      `INSERT INTO audit_log (operation, entity_type, entity_id, changes, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [operation, entityType, entityId ?? null, changes ? JSON.stringify(changes) : null, source, Date.now()],
    )
    return result.lastInsertRowid as number
  }

  async query(filters: AuditQuery = {}): Promise<AuditEntry[]> {
    const clauses: string[] = []
    const vals: (string | number)[] = []
    if (filters.entityType) { clauses.push('entity_type = ?'); vals.push(filters.entityType) }
    if (filters.entityId) { clauses.push('entity_id = ?'); vals.push(filters.entityId) }
    if (filters.source) { clauses.push('source = ?'); vals.push(filters.source) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    return this.db.query<Record<string, unknown>>(
      `SELECT id, operation, entity_type, entity_id, changes, source, created_at
       FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...vals, limit, offset],
    ).then((rows) => rows.map(rowToAudit))
  }

  async getRecent(limit = 20): Promise<AuditEntry[]> {
    return this.db.query<Record<string, unknown>>(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?', [limit],
    ).then((rows) => rows.map(rowToAudit))
  }

  async count(filters?: { entityType?: string; source?: string }): Promise<number> {
    const clauses: string[] = []
    const vals: string[] = []
    if (filters?.entityType) { clauses.push('entity_type = ?'); vals.push(filters.entityType) }
    if (filters?.source) { clauses.push('source = ?'); vals.push(filters.source) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await this.db.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM audit_log ${where}`, vals,
    )
    return rows[0]?.cnt ?? 0
  }
}

function rowToAudit(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as number,
    operation: r.operation as string,
    entityType: r.entity_type as string,
    entityId: (r.entity_id as string) ?? null,
    changes: (r.changes as string) ?? null,
    source: (r.source as AuditEntry['source']) ?? 'manual',
    createdAt: r.created_at as number,
  }
}
