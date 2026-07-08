/**
 * OSS Sync — Portal/App PULL-ONLY.
 *
 * PC/author writes articles → uploads DB dump to OSS via Makefile.
 * Portal/App only pulls (downloads) from OSS — never pushes.
 *
 * OSS directory layout (clean, independent of old doc sync):
 *   oss://{bucket}/{path}/
 *     kbdata/
 *       latest.json           — pointer to latest full DB dump
 *       {timestamp}.json      — versioned snapshots
 */

import type { DatabaseDump } from '../driver/types.js'
import { debugLog } from '../debug.js'

// ── Table classification ────────────────────────────────────────────────────

/** Tables whose source-of-truth is PC (uploaded to OSS, App REPLACEs on sync). */
export const STRUCTURAL_TABLES = [
  'series',
  'groups',
  'articles',
  'article_links',
  'schema_version',
] as const

/** Tables owned by App at runtime — NEVER uploaded to OSS, NEVER overwritten. */
export const BEHAVIORAL_TABLES = [
  'preferences',
  'reading_history',
  'reading_positions',
  'audit_log',
] as const

export type StructuralTable = (typeof STRUCTURAL_TABLES)[number]

/** Filter a dump to only structural tables (for OSS upload). */
export function filterStructural(dump: DatabaseDump): DatabaseDump {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const name of STRUCTURAL_TABLES) {
    if (dump.tables[name]) tables[name] = dump.tables[name]
  }
  return { ...dump, tables }
}

// ── Config ───────────────────────────────────────────────────────────────────

export interface OssConfig {
  bucket: string
  region: string
  endpoint?: string       // e.g. https://oss-cn-shenzhen.aliyuncs.com (takes precedence over bucket+region for URL)
  accessKeyId: string
  accessKeySecret: string
  path?: string
}

export interface OssResult {
  success: boolean
  key?: string
  sizeBytes?: number
  error?: string
}

// ── HMAC-SHA1 signing ──────────────────────────────────────────────────────

async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function ossSign(method: string, objectKey: string, bucket: string, akId: string, akSecret: string, contentType?: string): Promise<string> {
  const date = new Date().toUTCString()
  const ct = contentType || (method === 'PUT' ? 'application/json' : '')
  const stringToSign = [method, '', ct, date, `/${bucket}/${objectKey}`].join('\n')
  const signature = await hmacSha1(akSecret, stringToSign)
  return `OSS ${akId}:${signature}`
}

function ossUrl(bucket: string, region: string, objectKey: string): string {
  return `https://${bucket}.${region}.aliyuncs.com/${objectKey}`
}

// ── Pull API (portal/app) ─────────────────────────────────────────────────

/** Download the latest DB snapshot from OSS. */
export async function pullLatest(config: OssConfig): Promise<OssResult & { dump?: DatabaseDump }> {
  const base = config.path || 'lz-learn-portal-sqllite-data'
  const key = `${base}/kbdata/latest.json`
  const url = ossUrl(config.bucket, config.region, key)
  debugLog.info('oss', `pullLatest: ${url}`)
  try {
    const auth = await ossSign('GET', key, config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(url, { headers: { 'Date': new Date().toUTCString(), 'Authorization': auth } })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      debugLog.error('oss', `pullLatest failed: ${resp.status}`, errText.substring(0, 300))
      return { success: false, error: `OSS ${resp.status}` }
    }
    const text = await resp.text()
    const dump: DatabaseDump = JSON.parse(text)
    const rows = Object.values(dump.tables).reduce((s, r) => s + r.length, 0)
    debugLog.info('oss', `pullLatest OK: ${Object.keys(dump.tables).length} tables, ${rows} rows, ${text.length} bytes`)
    return { success: true, key, sizeBytes: text.length, dump }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    debugLog.error('oss', `pullLatest error: ${msg}`, url)
    return { success: false, error: msg }
  }
}

/**
 * Merge remote OSS dump into local DB (incremental).
 * Remote = source of truth for structure (series, groups, articles, links).
 * Local = source of truth for user data (reading_history, positions, preferences).
 */
export function mergeFromOss(localDump: DatabaseDump, remoteDump: DatabaseDump): DatabaseDump {
  const merged: DatabaseDump = {
    version: 1, exportedAt: Date.now(), driverType: localDump.driverType,
    schemaVersion: Math.max(localDump.schemaVersion, remoteDump.schemaVersion), tables: {},
  }
  // Structural → from remote (PC source of truth)
  for (const t of STRUCTURAL_TABLES) {
    merged.tables[t] = remoteDump.tables[t] ?? localDump.tables[t] ?? []
  }
  // Behavioral → from local (App owns this data)
  for (const t of BEHAVIORAL_TABLES) {
    merged.tables[t] = localDump.tables[t] ?? remoteDump.tables[t] ?? []
  }
  // Unknown tables → preserve local
  for (const t of Object.keys(localDump.tables)) {
    if (!STRUCTURAL_TABLES.includes(t as StructuralTable) && !BEHAVIORAL_TABLES.includes(t as any)) {
      merged.tables[t] = localDump.tables[t]
    }
  }
  return merged
}

// ── Push API (PC-side Makefile only, NOT used in portal/app) ──────────────

/** Upload a DB dump to OSS + update latest.json pointer. PC-side only. */
export async function uploadSnapshot(dump: DatabaseDump, config: OssConfig): Promise<OssResult> {
  // Only upload structural tables — behavioral tables are App-local, never leave the device
  const filtered = filterStructural(dump)
  const base = config.path || 'lz-learn-portal-sqllite-data'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const key = `${base}/kbdata/${ts}.json`
  const url = ossUrl(config.bucket, config.region, key)
  const body = JSON.stringify(filtered)
  try {
    const auth = await ossSign('PUT', key, config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Date': new Date().toUTCString(), 'Authorization': auth }, body,
    })
    if (!resp.ok) return { success: false, error: `OSS ${resp.status}` }
    // Also update latest.json
    const lk = `${base}/kbdata/latest.json`
    const la = await ossSign('PUT', lk, config.bucket, config.accessKeyId, config.accessKeySecret)
    await fetch(ossUrl(config.bucket, config.region, lk), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Date': new Date().toUTCString(), 'Authorization': la }, body,
    })
    return { success: true, key, sizeBytes: body.length }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
