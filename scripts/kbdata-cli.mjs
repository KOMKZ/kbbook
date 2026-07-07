#!/usr/bin/env node
/**
 * kbdata-cli — KBBook SQLite database CLI.
 *
 * LLM/lz-ai-learning skill 通过本工具直接操作 SQLite 数据库，
 * 无需维护 _meta.json。数据库文件可上传 OSS 供 portal/app 拉取。
 *
 * Commands:
 *   node scripts/kbdata-cli.mjs init [db.kbdata]
 *   node scripts/kbdata-cli.mjs exec "SQL" [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs query "SELECT ..." [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs export [dump.json] [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs import dump.json [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs scan ./public/docs [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs upload-oss [--db db.kbdata]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join, basename, dirname } from 'node:path'

const DEFAULT_DB = resolve('kbbsqllite.kbdata')

// ── SQLite ──────────────────────────────────────────────────────────────────

async function openDb(dbPath) {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  let data
  if (existsSync(dbPath)) {
    data = readFileSync(dbPath)
  }
  const db = new SQL.Database(data)
  // Bootstrap schema
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER)`)
  db.run(`CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, title TEXT NOT NULL, short_title TEXT, tagline TEXT, description TEXT, icon TEXT, color TEXT, enabled INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`)
  db.run(`CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, series_id TEXT NOT NULL REFERENCES series(id), parent_group_id TEXT REFERENCES groups(id), title TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER DEFAULT 0, UNIQUE(series_id, slug))`)
  db.run(`CREATE TABLE IF NOT EXISTS articles (slug TEXT PRIMARY KEY, series_id TEXT NOT NULL REFERENCES series(id), group_id TEXT REFERENCES groups(id), title TEXT NOT NULL, description TEXT, content TEXT, word_count INTEGER DEFAULT 0, read_time_mins INTEGER DEFAULT 0, status TEXT DEFAULT 'published', tags TEXT, frontmatter TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`)
  db.run(`CREATE TABLE IF NOT EXISTS article_links (id INTEGER PRIMARY KEY AUTOINCREMENT, source_slug TEXT NOT NULL, target_slug TEXT NOT NULL, link_type TEXT DEFAULT 'reference', context TEXT, UNIQUE(source_slug, target_slug, link_type))`)
  db.run(`CREATE TABLE IF NOT EXISTS reading_history (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, series_id TEXT NOT NULL, title TEXT NOT NULL, read_at INTEGER NOT NULl)`)
  db.run(`CREATE TABLE IF NOT EXISTS reading_positions (slug TEXT PRIMARY KEY, series_id TEXT NOT NULL, version TEXT NOT NULL, top REAL DEFAULT 0, ratio REAL DEFAULT 0, updated_at INTEGER NOT NULL)`)
  db.run(`CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULl)`)
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, operation TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, changes TEXT, source TEXT DEFAULT 'manual', created_at INTEGER NOT NULL)`)
  return { SQL, db }
}

async function saveDb(dbPath, db) {
  const data = db.export()
  writeFileSync(dbPath, data)
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdInit(dbPath) {
  const { db } = await openDb(dbPath)
  await saveDb(dbPath, db)
  db.close()
  console.log(JSON.stringify({ ok: true, db: dbPath }))
}

async function cmdExec(dbPath, sql) {
  const { db } = await openDb(dbPath)
  try {
    db.run(sql)
    const changes = db.exec('SELECT changes() as c')[0]?.values[0][0] ?? 0
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]
    await saveDb(dbPath, db)
    db.close()
    console.log(JSON.stringify({ ok: true, changes, lastInsertRowid: lastId ?? null }))
  } catch (err) {
    db.close()
    console.error(JSON.stringify({ ok: false, error: err.message }))
    process.exit(1)
  }
}

async function cmdQuery(dbPath, sql) {
  const { db } = await openDb(dbPath)
  try {
    const results = db.exec(sql)
    const rows = []
    if (results.length) {
      for (const { columns, values } of results) {
        for (const vals of values) {
          const row = {}
          columns.forEach((c, i) => row[c] = vals[i])
          rows.push(row)
        }
      }
    }
    db.close()
    console.log(JSON.stringify(rows))
  } catch (err) {
    db.close()
    console.error(JSON.stringify({ ok: false, error: err.message }))
    process.exit(1)
  }
}

async function cmdExport(dbPath, outPath) {
  const { db } = await openDb(dbPath)
  const tableQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  const tables = {}
  for (const { values } of tableQuery) {
    for (const [name] of values) {
      const data = db.exec(`SELECT * FROM "${name}"`)
      if (data.length) {
        const { columns, values: rows } = data[0]
        tables[name] = rows.map(vals => {
          const r = {}
          columns.forEach((c, i) => r[c] = vals[i])
          return r
        })
      } else {
        tables[name] = []
      }
    }
  }
  db.close()
  const dump = { version: 1, exportedAt: Date.now(), driverType: 'sqljs', schemaVersion: 1, tables }
  const json = JSON.stringify(dump, null, 2)
  if (outPath) writeFileSync(outPath, json)
  else console.log(json)
}

async function cmdImport(dbPath, inPath) {
  const { db } = await openDb(dbPath)
  const dump = JSON.parse(readFileSync(inPath, 'utf8'))

  // Clear existing user tables
  const existing = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  for (const { values } of existing) {
    for (const [name] of values) {
      db.run(`DROP TABLE IF EXISTS "${name}"`)
    }
  }

  // Recreate from dump
  for (const [tableName, rows] of Object.entries(dump.tables)) {
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    const colDefs = cols.map(c => `"${c}" ${typeof rows[0][c] === 'number' ? 'REAL' : 'TEXT'}`).join(', ')
    db.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`)
    for (const row of rows) {
      const vals = cols.map(c => row[c])
      const ph = vals.map(() => '?').join(', ')
      db.run(`INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${ph})`, vals)
    }
  }

  await saveDb(dbPath, db)
  db.close()
  const totalRows = Object.values(dump.tables).reduce((s, r) => s + r.length, 0)
  console.log(JSON.stringify({ ok: true, tables: Object.keys(dump.tables).length, rows: totalRows }))
}

/**
 * Scan .md files for YAML frontmatter → upsert into SQLite.
 *
 * Expected .md structure:
 *   ---
 *   title: Article Title
 *   series: go-basic
 *   group: high-order
 *   order: 1
 *   tags: [go, memory]
 *   status: published
 *   ---
 *   # Article Title
 *   ...
 */
async function cmdScan(dbPath, docsDir) {
  const { db } = await openDb(dbPath)
  const now = Date.now()
  let count = 0

  function walk(dir, seriesId = null) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full, seriesId)
      } else if (e.name.endsWith('.md')) {
        try {
          const content = readFileSync(full, 'utf8')
          const fm = parseFrontmatter(content)
          if (!fm.title) return

          const slug = fm.slug || basename(e.name, '.md')
          const sid = fm.series || seriesId || 'default'
          const gid = fm.group ? `${sid}:${fm.group}` : null

          // Ensure series exists
          db.run('INSERT OR IGNORE INTO series (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [sid, sid, now, now])

          // Upsert article
          const existing = db.exec('SELECT slug FROM articles WHERE slug = ?', [slug])
          if (existing.length && existing[0].values.length) {
            db.run(`UPDATE articles SET series_id=?, group_id=?, title=?, description=?, content=?, tags=?, status=?, updated_at=? WHERE slug=?`,
              [sid, gid, fm.title, fm.description || null, content, JSON.stringify(fm.tags || []), fm.status || 'published', now, slug])
          } else {
            db.run(`INSERT INTO articles (slug, series_id, group_id, title, description, content, tags, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
              [slug, sid, gid, fm.title, fm.description || null, content, JSON.stringify(fm.tags || []), fm.status || 'published', now, now])
          }
          count++
        } catch (err) {
          console.error(JSON.stringify({ warning: `skip ${e.name}: ${err.message}` }))
        }
      } else if (e.name === 'series.json') {
        // Read series definitions
        try {
          const raw = JSON.parse(readFileSync(full, 'utf8'))
          for (const s of (raw.series || [])) {
            if (!s.enabled) continue
            db.run(`INSERT OR REPLACE INTO series (id, title, short_title, tagline, description, icon, color, enabled, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [s.id, s.title, s.shortTitle || null, s.tagline || null, s.description || null, s.icon || null, s.color || null, s.enabled ? 1 : 0, 0, now, now])
          }
        } catch {}
      }
    }
  }

  walk(docsDir)
  await saveDb(dbPath, db)
  db.close()
  console.log(JSON.stringify({ ok: true, articles: count }))
}

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return {}
  const result = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/)
    if (!kv) continue
    const k = kv[2]
    try { result[kv[1]] = JSON.parse(k) } catch { result[kv[1]] = k }
  }
  return result
}

async function cmdUploadOss(dbPath) {
  // Read OSS config from env or .env
  const bucket = process.env.OSS_BUCKET || 'yogan-static'
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou'
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET

  if (!accessKeyId || !accessKeySecret) {
    console.error(JSON.stringify({ ok: false, error: 'Missing OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET env vars' }))
    process.exit(1)
  }

  // Export DB to JSON
  const { db } = await openDb(dbPath)
  const dump = { version: 1, exportedAt: Date.now(), driverType: 'sqljs', schemaVersion: 1, tables: {} }
  const tableQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  for (const { values } of tableQuery) {
    for (const [name] of values) {
      const data = db.exec(`SELECT * FROM "${name}"`)
      if (data.length) {
        const { columns, values: rows } = data[0]
        dump.tables[name] = rows.map(vals => {
          const r = {}
          columns.forEach((c, i) => r[c] = vals[i])
          return r
        })
      }
    }
  }
  db.close()

  const basePath = process.env.OSS_PATH || 'kbbsqllite-data'
  const body = JSON.stringify(dump)
  const now = new Date().toISOString().replace(/[:.]/g, '-')
  const key = `${basePath}/kbdata/${now}.json`

  // Use fetch with HMAC signing (requires Node 18+)
  const crypto = await import('node:crypto')
  function sign(method, objectKey) {
    const date = new Date().toUTCString()
    const sts = [method, '', 'application/json', date, `/${bucket}/${objectKey}`].join('\n')
    const sig = crypto.createHmac('sha1', accessKeySecret).update(sts).digest('base64')
    return `OSS ${accessKeyId}:${sig}`
  }

  const url = `https://${bucket}.${region}.aliyuncs.com/${key}`
  const auth = sign('PUT', key)
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Date': new Date().toUTCString(), 'Authorization': auth },
    body,
  })
  if (!resp.ok) {
    console.error(JSON.stringify({ ok: false, error: `OSS upload failed: ${resp.status}` }))
    process.exit(1)
  }

  // Also update latest.json
  const latestKey = `${basePath}/kbdata/latest.json`
  const latestAuth = sign('PUT', latestKey)
  await fetch(`https://${bucket}.${region}.aliyuncs.com/${latestKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Date': new Date().toUTCString(), 'Authorization': latestAuth },
    body,
  })

  console.log(JSON.stringify({ ok: true, key, size: body.length }))
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const cmd = args[0]

let dbPath = DEFAULT_DB
const dbIdx = args.indexOf('--db')
if (dbIdx !== -1) dbPath = resolve(args[dbIdx + 1])

if (!cmd || cmd === 'help') {
  console.log(`kbdata-cli — KBBook SQLite database tool

Usage:
  node scripts/kbdata-cli.mjs init [db.kbdata]
  node scripts/kbdata-cli.mjs exec "<SQL>" [--db db.kbdata]
  node scripts/kbdata-cli.mjs query "<SQL>" [--db db.kbdata]
  node scripts/kbdata-cli.mjs export [dump.json] [--db db.kbdata]
  node scripts/kbdata-cli.mjs import <dump.json> [--db db.kbdata]
  node scripts/kbdata-cli.mjs scan <docs-dir> [--db db.kbdata]
  node scripts/kbdata-cli.mjs upload-oss [--db db.kbdata]

Examples:
  node scripts/kbdata-cli.mjs init
  node scripts/kbdata-cli.mjs exec "INSERT INTO series (id, title, created_at, updated_at) VALUES ('go', 'Go', $(date +%s)000, $(date +%s)000)"
  node scripts/kbdata-cli.mjs query "SELECT slug, title FROM articles WHERE series_id='go'"
  node scripts/kbdata-cli.mjs scan public/docs
  node scripts/kbdata-cli.mjs export dump.json
  node scripts/kbdata-cli.mjs upload-oss`)
  process.exit(0)
}

;(async () => {
  try {
    switch (cmd) {
      case 'init': await cmdInit(args[1] || dbPath); break
      case 'exec': await cmdExec(dbPath, args[1]); break
      case 'query': await cmdQuery(dbPath, args[1]); break
      case 'export': await cmdExport(dbPath, args[1]); break
      case 'import': await cmdImport(dbPath, args[1]); break
      case 'scan': await cmdScan(dbPath, args[1] || 'public/docs'); break
      case 'upload-oss': await cmdUploadOss(dbPath); break
      default: console.error(`Unknown command: ${cmd}`); process.exit(1)
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }))
    process.exit(1)
  }
})()
