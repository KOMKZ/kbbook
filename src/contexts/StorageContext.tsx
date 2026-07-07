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
import { createDriver, detectAvailableDrivers } from '@/data/driver/factory.js'
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
import type { DriverType } from '@/data/driver/factory.js'
import { MetaSyncService } from '@/data/sync/metasync.js'
import type { SeriesJsonFile, MetaJsonFile } from '@/data/sync/metasync.js'
import { debugLog } from '@/data/debug.js'

/** Load series.json + _meta.json files → sync to SQLite (idempotent). */
async function syncFiles(driver: IStorageDriver) {
  const sync = new MetaSyncService(driver)
  let seriesCount = 0, articleCount = 0, groupCount = 0
  try {
    const seriesResp = await fetch('/docs/series.json')
    if (!seriesResp.ok) { debugLog.warn('sync', 'series.json 加载失败', { status: seriesResp.status }); return }
    const seriesFile: SeriesJsonFile = await seriesResp.json()
    const sr = await sync.syncSeries(seriesFile)
    seriesCount = sr.series

    for (const s of seriesFile.series) {
      if (!s.enabled) continue
      const lang = (s as any).language || 'zh-CN'
      const version = (s as any).version || 'v0.1.0'
      try {
        const metaResp = await fetch(`/docs/${lang}/${version}/_meta.json`)
        if (!metaResp.ok) { debugLog.warn('sync', `${s.id} _meta.json 加载失败`, { status: metaResp.status }); continue }
        const metaFile: MetaJsonFile = await metaResp.json()
        const mr = await sync.syncMeta(s.id, metaFile)
        groupCount += mr.groups
        articleCount += mr.articles
      } catch { /* skip broken meta files */ }
    }
    debugLog.info('sync', '文件同步完成', { series: seriesCount, groups: groupCount, articles: articleCount })
  } catch (err) {
    debugLog.warn('sync', 'syncFiles 异常', { error: err instanceof Error ? err.message : String(err) })
  }
}

interface StorageState {
  driver: IStorageDriver | null
  ready: boolean
  error: string | null
  driverType: DriverType
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
  driver: null,
  ready: false,
  error: null,
  driverType: 'localstorage',
  repos: null,
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
    driver: null, ready: false, error: null, driverType: 'localstorage',
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Determine driver type
      const stored = localStorage.getItem('kbbook-storage-driver') as DriverType | null
      const available = detectAvailableDrivers()
      const driverType: DriverType = stored && available.includes(stored) ? stored : 'sqljs'

      try {
        // Restore debug toggle
        if (localStorage.getItem('kbbook-debug-enabled') === '1') debugLog.setEnabled(true)

        debugLog.info('storage', `选择驱动: ${driverType}`, { available: available.join(',') })
        const d = createDriver(driverType)
        await d.open()
        debugLog.info('storage', `${driverType} 已打开`, { persistent: (d as any).persistent })

        // Run migrations (idempotent)
        const runner = new MigrationRunner(d, allMigrations)
        const prevVersion = await runner.currentVersion()
        const newVersion = await runner.run()
        debugLog.info('migration', `schema ${prevVersion} → ${newVersion}`, { latest: runner.latestVersion() })

        // Sync file data (series.json + _meta.json) into SQLite
        await syncFiles(d)

        if (cancelled) { await d.close(); return }

        debugLog.info('storage', '初始化完成', { driverType, schemaVersion: newVersion })
        setState({ driver: d, ready: true, error: null, driverType })
      } catch (err) {
        debugLog.error('storage', '初始化失败', { error: err instanceof Error ? err.message : String(err) })
        if (!cancelled) {
          setState({
            driver: null,
            ready: false,
            error: err instanceof Error ? err.message : 'Storage init failed',
            driverType: 'localstorage',
          })
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
    // Register bridge for non-React consumers (usePersistentState, etc.)
    setStorageBridge(r.preferences)
    return r
  }, [state.driver, state.ready])

  return (
    <StorageCtx.Provider value={{ ...state, repos }}>
      {children}
    </StorageCtx.Provider>
  )
}
