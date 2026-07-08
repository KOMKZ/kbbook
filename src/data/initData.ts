import type { IStorageDriver } from './driver/types.js'
import { debugLog } from './debug.js'

const INIT_DB_URL = '/kbbsqllite-init.kbdata'
const INIT_FINGERPRINT_KEY = 'kbbook-init-kbdata-fingerprint'
const INIT_REFRESHED_AT_KEY = 'kbbook-init-kbdata-refreshed-at'

const DELETE_ORDER = ['article_links', 'articles', 'groups', 'series'] as const
const INSERT_ORDER = ['series', 'groups', 'articles', 'article_links'] as const

interface ContentCounts {
  series: number
  groups: number
  articles: number
  groupedArticles: number
}

export interface InitDataRefreshReport {
  reason: string
  fingerprint: string
  totalRows: number
  tables: Record<string, number>
  before: ContentCounts
  after: ContentCounts
}

async function fetchBundledInitDb(): Promise<ArrayBuffer> {
  const resp = await fetch(INIT_DB_URL, { cache: 'no-cache' })
  if (!resp.ok) {
    throw new Error(`.kbdata fetch failed: ${resp.status} ${resp.statusText}`)
  }
  return resp.arrayBuffer()
}

async function fingerprintBuffer(buf: ArrayBuffer): Promise<string> {
  try {
    const digest = await globalThis.crypto?.subtle?.digest('SHA-256', buf)
    if (digest) {
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
      return `sha256:${hex}:${buf.byteLength}`
    }
  } catch {}
  return `bytes:${buf.byteLength}`
}

async function readPreference(d: IStorageDriver, key: string): Promise<string | null> {
  try {
    const rows = await d.query<{ value: string }>('SELECT value FROM preferences WHERE key = ?', [key])
    if (!rows.length) return null
    try {
      const parsed = JSON.parse(rows[0].value)
      return typeof parsed === 'string' ? parsed : String(parsed)
    } catch {
      return rows[0].value
    }
  } catch {
    return null
  }
}

async function writePreference(d: IStorageDriver, key: string, value: unknown): Promise<void> {
  await d.exec(
    'INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)',
    [key, JSON.stringify(value), Date.now()],
  )
}

export async function getContentCounts(d: IStorageDriver): Promise<ContentCounts> {
  const queryCount = async (sql: string) => {
    const rows = await d.query<{ c: number }>(sql)
    return Number(rows[0]?.c || 0)
  }
  return {
    series: await queryCount('SELECT COUNT(*) as c FROM series'),
    groups: await queryCount('SELECT COUNT(*) as c FROM groups'),
    articles: await queryCount('SELECT COUNT(*) as c FROM articles'),
    groupedArticles: await queryCount('SELECT COUNT(*) as c FROM articles WHERE group_id IS NOT NULL'),
  }
}

function isContentUnhealthy(counts: ContentCounts): boolean {
  if (counts.series === 0 || counts.articles === 0) return true
  return counts.groups > 0 && counts.groupedArticles === 0
}

async function replaceContentTables(d: IStorageDriver, buf: ArrayBuffer): Promise<Record<string, number>> {
  const SQL = (await import('sql.js')).default
  const initSql = await SQL()
  const tempDb = new initSql.Database(new Uint8Array(buf))
  const tables: Record<string, number> = {}

  try {
    for (const table of DELETE_ORDER) {
      await d.exec(`DELETE FROM "${table}"`)
    }

    for (const table of INSERT_ORDER) {
      const data = tempDb.exec(`SELECT * FROM "${table}"`)
      if (!data.length || !data[0].values.length) {
        tables[table] = 0
        continue
      }

      const cols = data[0].columns
      const ph = cols.map(() => '?').join(',')
      const colSql = cols.map((c) => `"${c}"`).join(',')
      let rows = 0

      for (const row of data[0].values) {
        await d.exec(`INSERT OR REPLACE INTO "${table}" (${colSql}) VALUES (${ph})`, row as any[])
        rows++
      }
      tables[table] = rows
    }
  } finally {
    tempDb.close()
  }

  return tables
}

export async function refreshBundledContentData(
  d: IStorageDriver,
  reason = 'manual',
): Promise<InitDataRefreshReport> {
  const before = await getContentCounts(d)
  const buf = await fetchBundledInitDb()
  const fingerprint = await fingerprintBuffer(buf)
  const tables = await replaceContentTables(d, buf)
  const totalRows = Object.values(tables).reduce((sum, rows) => sum + rows, 0)

  await writePreference(d, INIT_FINGERPRINT_KEY, fingerprint)
  await writePreference(d, INIT_REFRESHED_AT_KEY, Date.now())

  const after = await getContentCounts(d)
  debugLog.info('storage', `bundled content refreshed: ${reason}`, {
    fingerprint,
    tables,
    before,
    after,
  })

  return { reason, fingerprint, totalRows, tables, before, after }
}

export async function ensureBundledContentData(d: IStorageDriver): Promise<InitDataRefreshReport | null> {
  const before = await getContentCounts(d)
  const buf = await fetchBundledInitDb()
  const fingerprint = await fingerprintBuffer(buf)
  const stored = await readPreference(d, INIT_FINGERPRINT_KEY)
  const missingMarker = !stored
  const fingerprintChanged = !!stored && stored !== fingerprint
  const unhealthy = isContentUnhealthy(before)

  if (!missingMarker && !fingerprintChanged && !unhealthy) {
    debugLog.info('storage', `content cache OK: ${before.articles} articles`)
    return null
  }

  const reason = unhealthy
    ? 'unhealthy-content'
    : missingMarker
      ? 'missing-fingerprint'
      : 'fingerprint-changed'
  const tables = await replaceContentTables(d, buf)
  const totalRows = Object.values(tables).reduce((sum, rows) => sum + rows, 0)

  await writePreference(d, INIT_FINGERPRINT_KEY, fingerprint)
  await writePreference(d, INIT_REFRESHED_AT_KEY, Date.now())

  const after = await getContentCounts(d)
  debugLog.info('storage', `bundled content refreshed: ${reason}`, {
    fingerprint,
    tables,
    before,
    after,
  })

  return { reason, fingerprint, totalRows, tables, before, after }
}
