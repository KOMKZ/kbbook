/**
 * StorageContext — global data-layer provider.
 *
 * Initialises sql.js WASM driver on startup, runs migrations,
 * and loads initial data from bundled .kbdata file if DB is empty.
 */

// OSS credentials injected at build time via Vite define (replaced at compile time)
declare const __OSS_ENDPOINT__: string
declare const __OSS_BUCKET__: string
declare const __OSS_PATH__: string
declare const __OSS_ACCESS_KEY_ID__: string
declare const __OSS_ACCESS_KEY_SECRET__: string

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { createDriver } from '@/data/driver/factory.js'
import { MigrationRunner } from '@/data/schema/migrations.js'
import { allMigrations } from '@/data/schema/index.js'
import { BackupManager } from '@/data/backup/manager.js'
import { setStorageBridge } from '@/data/bridge.js'
import {
  SeriesRepo, GroupRepo, ArticleRepo,
  ArticleLinkRepo, StatsRepo,
  ReadingHistoryRepo, ReadingPositionRepo,
  AuditLogRepo, PreferencesRepo,
} from '@/data/index.js'
import type { IStorageDriver } from '@/data/driver/types.js'
import { debugLog } from '@/data/debug.js'

interface StorageState {
  driver: IStorageDriver | null
  ready: boolean
  error: string | null
}

interface Repos {
  series: SeriesRepo; group: GroupRepo; article: ArticleRepo
  link: ArticleLinkRepo; stats: StatsRepo
  readingHistory: ReadingHistoryRepo; readingPosition: ReadingPositionRepo
  audit: AuditLogRepo; preferences: PreferencesRepo; backup: BackupManager
}

const StorageCtx = createContext<StorageState & { repos: Repos | null }>({
  driver: null, ready: false, error: null, repos: null,
})

export function useStorage() { return useContext(StorageCtx) }

export function useRepos(): Repos {
  const ctx = useContext(StorageCtx)
  if (!ctx.ready || !ctx.repos) throw new Error('Storage not ready')
  return ctx.repos
}

/** Load initial data from bundled .kbdata binary if DB is empty. */
async function loadInitialData(d: IStorageDriver) {
  const cnt = await d.query<{c:number}>('SELECT COUNT(*) as c FROM articles')
  if (cnt[0]?.c && cnt[0].c > 0) {
    console.log('[StorageProvider] DB already has data, skip init')
    debugLog.info('storage', `已有 ${cnt[0].c} 篇文章，跳过初始加载`)
    return
  }

  console.log('[StorageProvider] DB empty, loading /kbbsqllite-init.kbdata')
  const resp = await fetch('/kbbsqllite-init.kbdata')
  if (!resp.ok) {
    const err = `.kbdata fetch failed: ${resp.status} ${resp.statusText}`
    console.error('[StorageProvider]', err)
    debugLog.error('storage', err)
    throw new Error(err)
  }

  console.log('[StorageProvider] .kbdata fetched, size:', resp.headers.get('content-length'))
  const buf = await resp.arrayBuffer()
  console.log('[StorageProvider] Buffer size:', buf.byteLength)

  const SQL = (await import('sql.js')).default
  const initSql = await SQL()
  const tempDb = new initSql.Database(new Uint8Array(buf))

  let total = 0
  const tableList = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  for (const { values } of tableList) {
    for (const [tname] of values) {
      const name = tname as string
      if (!name || name === 'sqlite_sequence') continue
      const data = tempDb.exec(`SELECT * FROM "${name}"`)
      if (!data.length || !data[0].values.length) continue
      const cols = data[0].columns
      const rows = data[0].values
      console.log(`[StorageProvider] importing ${name}: ${rows.length} rows, cols:`, cols.join(','))
      for (const row of rows) {
        const vals: any[] = []
        for (let i = 0; i < cols.length; i++) vals.push(row[i])
        const ph = vals.map(() => '?').join(',')
        await d.exec(`INSERT OR IGNORE INTO "${name}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${ph})`, vals)
      }
      total += rows.length
    }
  }
  tempDb.close()
  console.log(`[StorageProvider] init complete: ${total} rows imported`)
  debugLog.info('storage', `初始数据加载完成: ${total} rows`)
}

/** Seed baked-in OSS credentials into preferences, filling empty values. */
async function seedOssCredentials(d: IStorageDriver) {
  try {
    const rows = await d.query<{key:string, value:string}>("SELECT key, value FROM preferences WHERE key = 'kbbook-oss-config'")
    if (!rows.length) return
    let cfg: Record<string, string>
    try { cfg = JSON.parse(rows[0].value) } catch { return }
    let changed = false
    const bk = (k: string, v: string) => { if (!cfg[k]) { cfg[k] = v; changed = true } }
    // Fill empty fields from Vite-injected globals (replaced at build time via define)
    bk('endpoint', (typeof __OSS_ENDPOINT__ !== 'undefined' && __OSS_ENDPOINT__) || 'https://oss-cn-shenzhen.aliyuncs.com')
    bk('bucket', (typeof __OSS_BUCKET__ !== 'undefined' && __OSS_BUCKET__) || 'yogan-static')
    bk('path', (typeof __OSS_PATH__ !== 'undefined' && __OSS_PATH__) || 'lz-learn-portal-sqllite-data')
    bk('accessKeyId', (typeof __OSS_ACCESS_KEY_ID__ !== 'undefined' && __OSS_ACCESS_KEY_ID__) || '')
    bk('accessKeySecret', (typeof __OSS_ACCESS_KEY_SECRET__ !== 'undefined' && __OSS_ACCESS_KEY_SECRET__) || '')
    if (changed) {
      await d.exec("UPDATE preferences SET value = ? WHERE key = 'kbbook-oss-config'", [JSON.stringify(cfg)])
      console.log('[StorageProvider] OSS credentials seeded')
    }
  } catch (e) { /* non-critical: user can enter manually */ }
}

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StorageState>({ driver: null, ready: false, error: null })

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        debugLog.info('storage', '初始化 SQLite')
        const d = createDriver('sqljs')
        await d.open()

        const runner = new MigrationRunner(d, allMigrations)
        const prevVersion = await runner.currentVersion()
        const newVersion = await runner.run()
        debugLog.info('migration', `schema ${prevVersion} → ${newVersion}`)

        await loadInitialData(d)

        // Seed baked-in OSS credentials into preferences (ensure never empty)
        await seedOssCredentials(d)

        if (cancelled) { await d.close(); return }
        debugLog.info('storage', '初始化完成')
        setState({ driver: d, ready: true, error: null })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        debugLog.error('storage', '初始化失败', { error: msg, stack: (err as Error).stack })
        console.error('[StorageProvider]', msg, err)
        if (!cancelled) setState({ driver: null, ready: false, error: msg })
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const repos: Repos | null = useMemo(() => {
    if (!state.driver || !state.ready) return null
    const d = state.driver
    const r = {
      series: new SeriesRepo(d), group: new GroupRepo(d), article: new ArticleRepo(d),
      link: new ArticleLinkRepo(d), stats: new StatsRepo(d),
      readingHistory: new ReadingHistoryRepo(d), readingPosition: new ReadingPositionRepo(d),
      audit: new AuditLogRepo(d), preferences: new PreferencesRepo(d), backup: new BackupManager(),
    }
    setStorageBridge(r.preferences, state.driver!)
    return r
  }, [state.driver, state.ready])

  if (!state.ready) {
    return (
      <StorageCtx.Provider value={{ ...state, repos }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">加载数据中...</Typography>
          {state.error && (
            <Typography variant="caption" color="error" sx={{ maxWidth: 400, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
              {state.error}
            </Typography>
          )}
        </Box>
      </StorageCtx.Provider>
    )
  }

  return <StorageCtx.Provider value={{ ...state, repos }}>{children}</StorageCtx.Provider>
}
