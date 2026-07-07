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
 *
 * Convenience commands (no raw SQL needed):
 *   node scripts/kbdata-cli.mjs series list [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs series add <id> <title> [--short <name>] [--icon 🚀]
 *   node scripts/kbdata-cli.mjs article list --series <id> [--db db.kbdata]
 *   node scripts/kbdata-cli.mjs article add <slug> <title> --series <id> [--group <slug>] [--content "..."] [--tags go,mem] [--status draft]
 *   node scripts/kbdata-cli.mjs article update <slug> --title "..." [--content "..."] [--status published]
 *   node scripts/kbdata-cli.mjs article delete <slug>
 *   node scripts/kbdata-cli.mjs link add <source> <target> [--type reference|prerequisite|extends]
 *   node scripts/kbdata-cli.mjs link list <slug>
 *   node scripts/kbdata-cli.mjs stats [--series <id>]
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
  db.run(`CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, title TEXT NOT NULL, short_title TEXT, tagline TEXT, description TEXT, icon TEXT, color TEXT, version TEXT, language TEXT, enabled INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0)`)
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

// ── Validation ─────────────────────────────────────────────────────────────

const VALID_SLUG = /^[a-zA-Z0-9][-a-zA-Z0-9_./]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/
const VALID_ID = /^[a-zA-Z0-9][-a-zA-Z0-9_]*$/
const VALID_STATUS = /^(draft|published|archived)$/
const VALID_LINK_TYPE = /^(reference|prerequisite|extends|related)$/

function fail(msg) { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1) }
function ok(data) { console.log(JSON.stringify({ ok: true, ...data })) }
function vSlug(v, name) { if (!v || !VALID_SLUG.test(v)) fail(`${name} must match ${VALID_SLUG}`) }
function vId(v, name) { if (!v || !VALID_ID.test(v)) fail(`${name} must match ${VALID_ID}`) }
function vStatus(v) { if (v && !VALID_STATUS.test(v)) fail(`status must be draft|published|archived`) }
function vLinkType(v) { if (v && !VALID_LINK_TYPE.test(v)) fail(`type must be reference|prerequisite|extends|related`) }

// ── Build initial DB from JSON files ──────────────────────────────────────

async function cmdBuildInit(args, dbPath) {
  const docsDir = resolve(args[1] || 'public/docs')
  const { db } = await openDb(dbPath)
  const now = Date.now()

  // 1. Load series.json
  const seriesPath = join(docsDir, 'series.json')
  if (!existsSync(seriesPath)) fail(`series.json not found at ${seriesPath}`)
  const seriesData = JSON.parse(readFileSync(seriesPath, 'utf8'))
  const seriesList = Array.isArray(seriesData) ? seriesData : (seriesData.series || [])

  let seriesCount = 0, groupCount = 0, articleCount = 0

  for (const s of seriesList) {
    if (!s.enabled) continue
    seriesCount++
    // Add version/language columns if not exist (ignore error if already present)
    for (const sql of [
      'ALTER TABLE series ADD COLUMN version TEXT',
      'ALTER TABLE series ADD COLUMN language TEXT',
    ]) { try { db.run(sql) } catch {} }
    db.run(`INSERT OR REPLACE INTO series (id, title, short_title, tagline, description, icon, color, enabled, sort_order, version, language, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.id, s.title, s.shortTitle || null, s.tagline || null, s.description || null,
       s.icon || null, s.color || null, s.enabled ? 1 : 0, seriesCount - 1,
       s.version || null, s.language || null, now, now])

    // 2. Load _meta.json for this series
    const lang = s.language || 'zh-CN'
    const version = s.version || 'v0.1.0'
    const metaPath = join(docsDir, lang, version, '_meta.json')
    if (!existsSync(metaPath)) continue

    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      // Recursively process items
      function processItems(items, parentGroupId = null) {
        for (const item of items) {
          const isGroup = item.isGroup === true || (item.items && item.items.length > 0)
          if (isGroup) {
            const gid = `${s.id}:${item.slug}`
            db.run(`INSERT OR REPLACE INTO groups (id, series_id, parent_group_id, title, slug, sort_order)
              VALUES (?,?,?,?,?,?)`,
              [gid, s.id, parentGroupId, item.title, item.slug, item.order || groupCount])
            groupCount++
            if (item.items) processItems(item.items, gid)
          } else {
            db.run(`INSERT OR REPLACE INTO articles (slug, series_id, group_id, title, status, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?)`,
              [item.slug, s.id, parentGroupId, item.title, 'published', now, now])
            articleCount++
          }
        }
      }
      processItems(meta.items || meta)
    } catch (e) {
      console.error(`  ⚠️  skip ${s.id} _meta.json: ${e.message}`)
    }
  }

  // 3. Insert default preferences
  const defaults = {
    'kbbook-theme-mode': 'dark',
    'kbbook-reading-history': '[]',
    'kbbook-oss-config': JSON.stringify({
      endpoint: 'https://oss-cn-shenzhen.aliyuncs.com',
      bucket: 'yogan-static',
      path: 'lz-learn-portal-sqllite-data',
      accessKeyId: '',
      accessKeySecret: '',
    }),
    'kbbook-toolbar-autohide': '10',
    'kbbook-debug-enabled': '0',
    'lz-home-layout': 'list',
    'kbbook-reader:fontScale.normal': '1',
    'kbbook-reader:fontScale.fullscreen': '1',
    'kbbook-reader:stickyTitle.hidden': 'false',
    'kbbook-reader:sidebar.collapsed': 'false',
  }
  for (const [key, value] of Object.entries(defaults)) {
    db.run('INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?,?,?)',
      [key, value, now])
  }

  await saveDb(dbPath, db)
  db.close()
  const sizeKB = (existsSync(dbPath) ? readFileSync(dbPath).length : 0) / 1024
  ok({ series: seriesCount, groups: groupCount, articles: articleCount, prefs: Object.keys(defaults).length, db: dbPath, sizeKB: Math.round(sizeKB) })
}

// ── Convenience commands ──────────────────────────────────────────────────

function parseOpts(args) {
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i]?.startsWith('--')) {
      const k = args[i].replace(/^--/, '')
      const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true'
      opts[k] = v
      if (v !== 'true') i++
    }
  }
  return opts
}

/** Execute parameterized SQL, auto-open and save the DB. */
async function dbExec(dbPath, sql, params = []) {
  const { db } = await openDb(dbPath)
  try {
    db.run(sql, params)
    const changes = db.exec('SELECT changes() as c')[0]?.values[0][0] ?? 0
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]
    await saveDb(dbPath, db)
    db.close()
    return { changes, lastInsertRowid: lastId ?? null }
  } catch (err) {
    db.close()
    fail(err.message)
  }
}

async function dbQuery(dbPath, sql, params = []) {
  const { db } = await openDb(dbPath)
  try {
    const results = db.exec(sql, params)
    const rows = []
    if (results.length) {
      for (const { columns, values } of results) {
        for (const vals of values) {
          const r = {}
          columns.forEach((c, i) => r[c] = vals[i])
          rows.push(r)
        }
      }
    }
    db.close()
    return rows
  } catch (err) {
    db.close()
    fail(err.message)
  }
}

async function cmdSeries(args, dbPath) {
  const sub = args[1]
  if (sub === 'list') {
    const rows = await dbQuery(dbPath, 'SELECT id, title, short_title, icon, enabled FROM series ORDER BY sort_order')
    return ok({ series: rows })
  }
  if (sub === 'add') {
    const id = args[2], title = args[3]
    if (!id || !title) fail('usage: series add <id> <title> [--short ...] [--icon ...]')
    vId(id, 'series id')
    const opts = parseOpts(args.slice(4))
    const now = Date.now()
    await dbExec(dbPath,
      'INSERT OR REPLACE INTO series (id, title, short_title, icon, enabled, created_at, updated_at) VALUES (?,?,?,?,1,?,?)',
      [id, title, opts.short || '', opts.icon || '', now, now])
    return ok({ series: id })
  }
  fail(`unknown series subcommand: ${sub}`)
}

async function cmdArticle(args, dbPath) {
  const sub = args[1]
  const opts = parseOpts(args.slice(2))

  if (sub === 'list') {
    const sid = opts.series
    if (!sid) fail('--series <id> required')
    vId(sid, 'series')
    const rows = await dbQuery(dbPath,
      'SELECT slug, title, group_id, status, word_count, updated_at FROM articles WHERE series_id=? ORDER BY updated_at DESC',
      [sid])
    return ok({ articles: rows })
  }
  if (sub === 'add') {
    const slug = args[2], title = args[3]
    if (!slug || !title) fail('usage: article add <slug> <title> --series <id>')
    if (!opts.series) fail('--series <id> required')
    vSlug(slug, 'slug'); vId(opts.series, 'series'); vStatus(opts.status)
    if (opts.group) vSlug(opts.group, 'group')
    const now = Date.now()
    const gid = opts.group ? `${opts.series}:${opts.group}` : null

    // Ensure series exists
    await dbExec(dbPath, 'INSERT OR IGNORE INTO series (id, title, created_at, updated_at) VALUES (?,?,?,?)', [opts.series, opts.series, now, now])
    if (gid) {
      await dbExec(dbPath, 'INSERT OR IGNORE INTO groups (id, series_id, title, slug, sort_order) VALUES (?,?,?,?,0)', [gid, opts.series, opts.group, opts.group])
    }
    await dbExec(dbPath,
      'INSERT OR REPLACE INTO articles (slug, series_id, group_id, title, content, tags, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [slug, opts.series, gid, title, opts.content || '', opts.tags || '', opts.status || 'published', now, now])
    return ok({ slug })
  }
  if (sub === 'update') {
    const slug = args[2]
    if (!slug) fail('usage: article update <slug> --title "..."')
    vSlug(slug, 'slug'); vStatus(opts.status)
    const now = Date.now()
    const sets = [], params = []
    if (opts.title) { sets.push('title=?'); params.push(opts.title) }
    if (opts.content) { sets.push('content=?'); params.push(opts.content) }
    if (opts.status) { sets.push('status=?'); params.push(opts.status) }
    if (opts.tags) { sets.push('tags=?'); params.push(opts.tags) }
    if (opts.group) { sets.push('group_id=?'); params.push(opts.group) }
    if (!sets.length) fail('no fields to update')
    sets.push('updated_at=?'); params.push(now)
    params.push(slug)
    await dbExec(dbPath, `UPDATE articles SET ${sets.join(',')} WHERE slug=?`, params)
    return ok({ slug })
  }
  if (sub === 'delete') {
    const slug = args[2]
    if (!slug) fail('usage: article delete <slug>')
    vSlug(slug, 'slug')
    await dbExec(dbPath, 'DELETE FROM articles WHERE slug=?', [slug])
    return ok({ slug })
  }
  if (sub === 'touch') {
    const slug = args[2]
    if (!slug) fail('usage: article touch <slug> [--word-count <n>]')
    vSlug(slug, 'slug')
    const now = Date.now()
    if (opts['word-count']) {
      await dbExec(dbPath, 'UPDATE articles SET updated_at=?, word_count=?, read_time_mins=? WHERE slug=?',
        [now, parseInt(opts['word-count']), Math.max(1, Math.round(parseInt(opts['word-count']) / 400)), slug])
    } else {
      await dbExec(dbPath, 'UPDATE articles SET updated_at=? WHERE slug=?', [now, slug])
    }
    return ok({ slug, updatedAt: now })
  }
  fail(`unknown article subcommand: ${sub}`)
}

async function cmdLink(args, dbPath) {
  const sub = args[1]
  if (sub === 'add') {
    const source = args[2], target = args[3]
    if (!source || !target) fail('usage: link add <sourceSlug> <targetSlug> [--type reference]')
    vSlug(source, 'source'); vSlug(target, 'target')
    const opts = parseOpts(args.slice(4))
    vLinkType(opts.type)
    await dbExec(dbPath,
      'INSERT OR IGNORE INTO article_links (source_slug, target_slug, link_type) VALUES (?,?,?)',
      [source, target, opts.type || 'reference'])
    return ok({ source, target })
  }
  if (sub === 'list') {
    const slug = args[2]
    if (!slug) fail('usage: link list <slug>')
    vSlug(slug, 'slug')
    const rows = await dbQuery(dbPath,
      `SELECT 'outgoing' as direction, target_slug as slug, link_type FROM article_links WHERE source_slug=?
       UNION ALL SELECT 'incoming' as direction, source_slug as slug, link_type FROM article_links WHERE target_slug=?`,
      [slug, slug])
    return ok({ links: rows })
  }
  fail(`unknown link subcommand: ${sub}`)
}

async function cmdStats(args, dbPath) {
  const opts = parseOpts(args)
  if (opts.series) {
    vId(opts.series, 'series')
    const rows = await dbQuery(dbPath,
      `SELECT COUNT(*) as article_count,
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft_count,
        COALESCE(SUM(word_count),0) as total_words
      FROM articles WHERE series_id=?`, [opts.series])
    return ok(rows[0])
  }
  const rows = await dbQuery(dbPath,
    `SELECT (SELECT COUNT(*) FROM series) as series_count,
      (SELECT COUNT(*) FROM articles) as article_count,
      (SELECT COUNT(*) FROM article_links) as link_count`)
  return ok(rows[0])
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const cmd = args[0]

let dbPath = DEFAULT_DB
const dbIdx = args.indexOf('--db')
if (dbIdx !== -1) dbPath = resolve(args[dbIdx + 1])

if (!cmd || cmd === 'help') {
  console.log(`kbdata-cli — KBBook SQLite database tool

Setup:
  node scripts/kbdata-cli.mjs build-init-db [docs-dir] [--db kbbsqllite.kbdata]
      Build initial SQLite database from series.json + _meta.json files.
      Run once to create the initial .kbdata file.

Raw SQL:
  node scripts/kbdata-cli.mjs init [db.kbdata]
  node scripts/kbdata-cli.mjs exec "<SQL>" [--db db.kbdata]
  node scripts/kbdata-cli.mjs query "<SQL>" [--db db.kbdata]
  node scripts/kbdata-cli.mjs export [dump.json] [--db db.kbdata]
  node scripts/kbdata-cli.mjs import <dump.json> [--db db.kbdata]
  node scripts/kbdata-cli.mjs scan <docs-dir> [--db db.kbdata]
  node scripts/kbdata-cli.mjs upload-oss [--db db.kbdata]

Convenience (no SQL needed):
  node scripts/kbdata-cli.mjs series list
  node scripts/kbdata-cli.mjs series add <id> <title> [--short <name>] [--icon 🚀]
  node scripts/kbdata-cli.mjs article list --series <id>
  node scripts/kbdata-cli.mjs article add <slug> <title> --series <id> [--group <grp>] [--content "..."] [--tags t1,t2] [--status draft|published]
  node scripts/kbdata-cli.mjs article update <slug> --title "..." [--content "..."] [--status published]
  node scripts/kbdata-cli.mjs article delete <slug>
  node scripts/kbdata-cli.mjs link add <source> <target> [--type reference|prerequisite|extends]
  node scripts/kbdata-cli.mjs link list <slug>
  node scripts/kbdata-cli.mjs stats [--series <id>]`)
  process.exit(0)
}

;(async () => {
  try {
    switch (cmd) {
      case 'init': await cmdInit(args[1] || dbPath); break
      case 'build-init-db': await cmdBuildInit(args, dbPath); break
      case 'exec': await cmdExec(dbPath, args[1]); break
      case 'query': await cmdQuery(dbPath, args[1]); break
      case 'export': await cmdExport(dbPath, args[1]); break
      case 'import': await cmdImport(dbPath, args[1]); break
      case 'scan': await cmdScan(dbPath, args[1] || 'public/docs'); break
      case 'upload-oss': await cmdUploadOss(dbPath); break
      case 'series': await cmdSeries(args, dbPath); break
      case 'article': await cmdArticle(args, dbPath); break
      case 'link': await cmdLink(args, dbPath); break
      case 'stats': await cmdStats(args, dbPath); break
      default: console.error(`Unknown command: ${cmd}`); process.exit(1)
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }))
    process.exit(1)
  }
})()
