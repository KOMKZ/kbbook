/**
 * StorageContext — global data-layer provider.
 *
 * Initialises the IStorageDriver on app startup, runs migrations,
 * and exposes repos + backup manager via React context.
 *
 * Driver selection: reads 'kbbook-storage-driver' from localStorage
 * (defaults to 'localstorage'). User can switch via Settings.
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
  series: SeriesRepo
  group: GroupRepo
  article: ArticleRepo
  link: ArticleLinkRepo
  stats: StatsRepo
  readingHistory: ReadingHistoryRepo
  readingPosition: ReadingPositionRepo
  audit: AuditLogRepo
  preferences: PreferencesRepo
  backup: BackupManager
}

const StorageCtx = createContext<StorageState & { repos: Repos | null }>({
  driver: null, ready: false, error: null, repos: null,
})

export function useStorage() {
  return useContext(StorageCtx)
}

/** Convenience hook — returns only the repos (throws if not ready). */
export function useRepos(): Repos {
  const ctx = useContext(StorageCtx)
  if (!ctx.ready || !ctx.repos) throw new Error('Storage not ready — wrap app in <StorageProvider>')
  return ctx.repos
}

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StorageState>({
    driver: null, ready: false, error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        debugLog.info('storage', '初始化 SQLite 驱动')
        const d = createDriver('sqljs')
        await d.open()
        debugLog.info('storage', 'sqljs 已打开', { persistent: (d as any).persistent })

        const runner = new MigrationRunner(d, allMigrations)
        const prevVersion = await runner.currentVersion()
        const newVersion = await runner.run()
        debugLog.info('migration', `schema ${prevVersion} → ${newVersion}`)

        // First launch: if DB is empty, load initial data from bundled .kbdata
        const cnt = await d.query<{c:number}>('SELECT COUNT(*) as c FROM articles')
        if (cnt[0]?.c === 0) {
          debugLog.info('storage', '空数据库，加载初始数据...')
          try {
            const resp = await fetch('/kbbsqllite-init.kbdata')
            if (resp.ok) {
              const buf = await resp.arrayBuffer()
              // Load the bundled DB as temp, export as JSON dump, import into main DB
              const SQL = (await import('sql.js')).default
              const initSql = await SQL()
              const tempDb = new initSql.Database(new Uint8Array(buf))
              // Export all tables from temp DB
              const tables: Record<string, any[]> = {}
              const tableNames = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
              for (const { values } of tableNames) {
                for (const [name] of values) {
                  const data = tempDb.exec(`SELECT * FROM "${name}"`)
                  if (data.length) {
                    tables[name] = data[0].values.map(vals => {
                      const r: Record<string, any> = {}
                      data[0].columns.forEach((c: string, i: number) => r[c] = vals[i])
                      return r
                    })
                  }
                }
              }
              tempDb.close()
              // Import into main DB
              for (const [tname, rows] of Object.entries(tables)) {
                if (!rows.length) continue
                const cols = Object.keys(rows[0])
                const colDefs = cols.map((c: string) => `"${c}" ${typeof rows[0][c] === 'number' ? 'REAL' : 'TEXT'}`).join(',')
                d.exec(`CREATE TABLE IF NOT EXISTS "${tname}" (${colDefs})`)
                for (const row of rows) {
                  const vals = cols.map((c: string) => row[c])
                  const ph = vals.map(() => '?').join(',')
                  d.exec(`INSERT OR IGNORE INTO "${tname}" (${cols.map((c: string) => `"${c}"`).join(',')}) VALUES (${ph})`, vals as any[])
                }
              }
              // Update schema version
              d.exec('INSERT OR REPLACE INTO schema_version (version, name, applied_at) VALUES (1, \'initial\', ?)', [Date.now()])
              debugLog.info('storage', `初始数据加载完成`, { series: tables.series?.length, articles: tables.articles?.length })
            }
          } catch (e) {
            debugLog.warn('storage', '初始数据加载失败', { error: (e as Error).message })
          }
        }

        if (cancelled) { await d.close(); return }

        debugLog.info('storage', '初始化完成', { schemaVersion: newVersion })
        setState({ driver: d, ready: true, error: null })
      } catch (err) {
        debugLog.error('storage', '初始化失败', { error: err instanceof Error ? err.message : String(err) })
        if (!cancelled) {
          setState({ driver: null, ready: false, error: err instanceof Error ? err.message : 'Storage init failed' })
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const repos: Repos | null = useMemo(() => {
    if (!state.driver || !state.ready) return null
    const d = state.driver
    const r = {
      series: new SeriesRepo(d),
      group: new GroupRepo(d),
      article: new ArticleRepo(d),
      link: new ArticleLinkRepo(d),
      stats: new StatsRepo(d),
      readingHistory: new ReadingHistoryRepo(d),
      readingPosition: new ReadingPositionRepo(d),
      audit: new AuditLogRepo(d),
      preferences: new PreferencesRepo(d),
      backup: new BackupManager(),
    }
    // Register bridge for non-React consumers (usePersistentState, OSS sync, etc.)
    setStorageBridge(r.preferences, state.driver!)
    return r
  }, [state.driver, state.ready])

  return (
    <StorageCtx.Provider value={{ ...state, repos }}>
      {children}
    </StorageCtx.Provider>
  )
}
