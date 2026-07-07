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

export interface OssConfig {
  bucket: string
  region: string
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

async function ossSign(method: string, objectKey: string, bucket: string, akId: string, akSecret: string): Promise<string> {
  const date = new Date().toUTCString()
  const stringToSign = [method, '', 'application/json', date, `/${bucket}/${objectKey}`].join('\n')
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
  try {
    const auth = await ossSign('GET', key, config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(url, { headers: { 'Date': new Date().toUTCString(), 'Authorization': auth } })
    if (!resp.ok) return { success: false, error: `OSS ${resp.status}` }
    const text = await resp.text()
    const dump: DatabaseDump = JSON.parse(text)
    return { success: true, key, sizeBytes: text.length, dump }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
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
  for (const t of ['series', 'groups', 'articles', 'article_links']) {
    merged.tables[t] = remoteDump.tables[t] ?? localDump.tables[t] ?? []
  }
  for (const t of ['reading_history', 'reading_positions', 'preferences', 'audit_log', 'stats_snapshot', 'migration_log']) {
    merged.tables[t] = localDump.tables[t] ?? remoteDump.tables[t] ?? []
  }
  return merged
}

// ── Push API (PC-side Makefile only, NOT used in portal/app) ──────────────

/** Upload a DB dump to OSS + update latest.json pointer. PC-side only. */
export async function uploadSnapshot(dump: DatabaseDump, config: OssConfig): Promise<OssResult> {
  const base = config.path || 'lz-learn-portal-sqllite-data'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const key = `${base}/kbdata/${ts}.json`
  const url = ossUrl(config.bucket, config.region, key)
  const body = JSON.stringify(dump)
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
