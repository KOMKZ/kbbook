/**
 * StorageContext — global data-layer provider.
 *
 * Initialises sql.js WASM driver on startup, runs migrations,
 * and loads initial data from bundled .kbdata file if DB is empty.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
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
  if (cnt[0]?.c && cnt[0].c > 0) return
  debugLog.info('storage', '空数据库，加载初始数据 /kbbsqllite-init.kbdata')

  const resp = await fetch('/kbbsqllite-init.kbdata')
  if (!resp.ok) {
    debugLog.warn('storage', `.kbdata fetch failed: ${resp.status}`)
    return
  }

  const buf = await resp.arrayBuffer()
  const SQL = (await import('sql.js')).default
  const initSql = await SQL()
  const tempDb = new initSql.Database(new Uint8Array(buf))

  // Export all user tables from temp DB
  const tableList = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  for (const { values } of tableList) {
    for (const [tname] of values) {
      const name = tname as string
      if (!name || name === 'sqlite_sequence') continue
      try {
        const data = tempDb.exec(`SELECT * FROM "${name}"`)
        if (!data.length || !data[0].values.length) continue
        const cols = data[0].columns
        const rows = data[0].values
        for (const row of rows) {
          const vals: any[] = []
          for (let i = 0; i < cols.length; i++) vals.push(row[i])
          const ph = vals.map(() => '?').join(',')
          await d.exec(
            `INSERT OR IGNORE INTO "${name}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${ph})`,
            vals,
          )
        }
      } catch {}
    }
  }
  tempDb.close()
  debugLog.info('storage', '初始数据加载完成')
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

        if (cancelled) { await d.close(); return }
        debugLog.info('storage', '初始化完成')
        setState({ driver: d, ready: true, error: null })
      } catch (err) {
        debugLog.error('storage', '初始化失败', { error: (err as Error).message })
        if (!cancelled) setState({ driver: null, ready: false, error: (err as Error).message })
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

  if (!state.ready && !state.error) {
    return <StorageCtx.Provider value={{ ...state, repos }}>{null}</StorageCtx.Provider>
  }

  return <StorageCtx.Provider value={{ ...state, repos }}>{children}</StorageCtx.Provider>
}
