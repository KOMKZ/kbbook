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
      const driverType: DriverType = stored && available.includes(stored) ? stored : 'localstorage'

      try {
        const d = createDriver(driverType)
        await d.open()

        // Run migrations (idempotent)
        const runner = new MigrationRunner(d, allMigrations)
        await runner.run()

        if (cancelled) { await d.close(); return }

        setState({ driver: d, ready: true, error: null, driverType })
      } catch (err) {
        console.error('StorageProvider init failed:', err)
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
