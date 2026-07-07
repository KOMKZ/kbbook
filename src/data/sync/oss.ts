/**
 * OSS Sync — Upload/download DatabaseDump to Alibaba Cloud OSS.
 *
 * Uses OSS REST API with HMAC-SHA1 signing (no SDK dependency).
 * Credentials come from kbbook-oss-config (same as docs sync).
 *
 * File layout on OSS:
 *   oss://{bucket}/{path}/kbbsqllite/
 *     backups/{deviceId}-{timestamp}.json   — manual backups
 *     latest.json                           — latest snapshot (auto-sync)
 */

import type { DatabaseDump } from '../driver/types.js'

export interface OssConfig {
  bucket: string
  region: string
  accessKeyId: string
  accessKeySecret: string
  path?: string  // defaults to 'lz-learn-portal-data'
}

export interface OssResult {
  success: boolean
  key?: string       // OSS object key
  sizeBytes?: number
  error?: string
}

// ── HMAC-SHA1 signing ──────────────────────────────────────────────────────

async function hmacSha1(key: string, data: string): Promise<string> {
  // Use Web Crypto API
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function ossSign(
  method: string, objectKey: string, bucket: string, accessKeyId: string, accessKeySecret: string,
): Promise<string> {
  const date = new Date().toUTCString()
  const contentType = 'application/json'

  const stringToSign = [
    method,
    '',                          // Content-MD5
    contentType,                 // Content-Type
    date,                        // Date
    `/${bucket}/${objectKey}`,   // CanonicalizedResource
  ].join('\n')

  const signature = await hmacSha1(accessKeySecret, stringToSign)
  return `OSS ${accessKeyId}:${signature}`
}

// ── Upload / Download ──────────────────────────────────────────────────────

function ossUrl(bucket: string, region: string, objectKey: string): string {
  return `https://${bucket}.${region}.aliyuncs.com/${objectKey}`
}

/** Upload a DatabaseDump JSON to OSS. */
export async function uploadToOss(dump: DatabaseDump, config: OssConfig, filename: string): Promise<OssResult> {
  const basePath = config.path || 'lz-learn-portal-data'
  const objectKey = `${basePath}/kbbsqllite/backups/${filename}`
  const url = ossUrl(config.bucket, config.region, objectKey)
  const body = JSON.stringify(dump)

  try {
    const auth = await ossSign('PUT', objectKey, config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Date': new Date().toUTCString(),
        'Authorization': auth,
      },
      body,
    })

    if (!resp.ok) {
      return { success: false, error: `OSS upload failed: ${resp.status} ${resp.statusText}` }
    }
    return { success: true, key: objectKey, sizeBytes: body.length }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Download a DatabaseDump JSON from OSS. */
export async function downloadFromOss(config: OssConfig, filename: string): Promise<OssResult & { dump?: DatabaseDump }> {
  const basePath = config.path || 'lz-learn-portal-data'
  const objectKey = `${basePath}/kbbsqllite/backups/${filename}`
  const url = ossUrl(config.bucket, config.region, objectKey)

  try {
    const auth = await ossSign('GET', objectKey, config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(url, {
      headers: {
        'Date': new Date().toUTCString(),
        'Authorization': auth,
      },
    })

    if (!resp.ok) {
      return { success: false, error: `OSS download failed: ${resp.status} ${resp.statusText}` }
    }

    const text = await resp.text()
    const dump: DatabaseDump = JSON.parse(text)
    return { success: true, key: objectKey, sizeBytes: text.length, dump }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** List backups on OSS (requires ListObjects permission). */
export async function listOssBackups(config: OssConfig): Promise<OssResult & { files?: { name: string; size: number; lastModified: string }[] }> {
  const basePath = config.path || 'lz-learn-portal-data'
  const prefix = `${basePath}/kbbsqllite/backups/`
  const url = `${ossUrl(config.bucket, config.region, '')}?prefix=${encodeURIComponent(prefix)}&max-keys=50`

  try {
    const auth = await ossSign('GET', '', config.bucket, config.accessKeyId, config.accessKeySecret)
    const resp = await fetch(`${url}`, {
      headers: {
        'Date': new Date().toUTCString(),
        'Authorization': auth,
      },
    })

    if (!resp.ok) {
      return { success: false, error: `OSS list failed: ${resp.status}` }
    }

    const xml = await resp.text()
    // Simple XML parsing for ListBucketResult
    const files: { name: string; size: number; lastModified: string }[] = []
    const matches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)
    for (const m of matches) {
      const block = m[1]
      const key = block.match(/<Key>(.*?)<\/Key>/)?.[1] || ''
      const size = parseInt(block.match(/<Size>(\d+)<\/Size>/)?.[1] || '0')
      const lm = block.match(/<LastModified>(.*?)<\/LastModified>/)?.[1] || ''
      files.push({ name: key.replace(prefix, ''), size, lastModified: lm })
    }
    return { success: true, files }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
