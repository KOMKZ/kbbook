/**
 * DocModeContext — 文档加载模式上下文
 *
 * 提供全局的 mode 状态和文档加载函数。
 * 在 App 根组件包裹，所有子组件通过 useDocMode() 消费。
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  getMode,
  setMode,
  getNetworkUrl,
  setNetworkUrl,
  getSyncStatus,
  syncFromOSS,
  resetAndSync,
  clearLocalData,
  readLocalDoc,
  type SyncStatus,
  type SyncResult,
  type OssConfig,
} from '../plugins/lz-portal-sync'
import { configureDocLoader, clearDocsCache, fetchWithTimeout, isHtmlFallback } from '../utils/docs'

interface DocModeState {
  mode: 'local' | 'network'
  networkUrl: string
  syncStatus: SyncStatus
  /** 增量同步进行中 */
  syncing: boolean
  /** "删除本地所有数据" 进行中 */
  clearing: boolean
  /** "全量同步（清空+重下）" 进行中 */
  fullResetting: boolean
  syncResult: SyncResult | null
  /** 每次 clear/sync/reset 完成后自增，驱动组件重新拉取数据 */
  dataVersion: number
}

interface DocModeContextValue extends DocModeState {
  switchMode: (mode: 'local' | 'network') => Promise<void>
  updateNetworkUrl: (url: string) => Promise<void>
  /** 增量同步：对比 manifest，只下载变更文件 */
  triggerSync: (ossCfg?: OssConfig) => Promise<SyncResult>
  /** 仅清除本地数据（synced-docs + manifest + prefs + JS 缓存），不触发同步 */
  triggerClearLocal: () => Promise<void>
  /** 全量同步：清空本地所有数据 → 从 OSS 全量重新下载 */
  triggerFullReset: (ossCfg?: OssConfig) => Promise<SyncResult>
  /** 模式感知的文档加载: 本地=插件读, 网络=fetch */
  loadDoc: (path: string) => Promise<string>
  loadJson: (path: string) => Promise<any>
  /** 每次 clear/sync/reset 完成后自增，驱动组件重新拉取数据 */
  dataVersion: number
}

const DocModeContext = createContext<DocModeContextValue | null>(null)

declare const __NETWORK_URL__: string
const DEFAULT_NETWORK_URL = (typeof __NETWORK_URL__ !== 'undefined' && __NETWORK_URL__) || 'http://localhost:3004'

/** Clear all JS-side caches (docs, meta, series, versions, mermaid). */
async function clearAllJsCaches() {
  clearDocsCache()
  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('kbbook-mermaid-cache')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve() // non-fatal
      req.onblocked = () => { setTimeout(() => resolve(), 500) }
    })
  } catch {}
  try { localStorage.removeItem('kbbook-sync-in-progress') } catch {}
}

export function DocModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DocModeState>({
    mode: 'local',
    networkUrl: DEFAULT_NETWORK_URL,
    syncStatus: { lastSyncTime: null, syncVersion: null, fileCount: 0, docsAvailable: false },
    syncing: false,
    clearing: false,
    fullResetting: false,
    syncResult: null,
    dataVersion: 0,
  })

  // 初始化: 从 native prefs / localStorage 恢复
  useEffect(() => {
    (async () => {
      const [m, url, status] = await Promise.all([
        getMode(),
        getNetworkUrl(),
        getSyncStatus(),
      ])
      setState((s) => ({
        ...s,
        mode: m as 'local' | 'network',
        networkUrl: url || DEFAULT_NETWORK_URL,
        syncStatus: status,
      }))
    })()
  }, [])

  // 同步模式到 docs.ts 的 configureDocLoader
  useEffect(() => {
    if (state.mode === 'local') {
      const dataCleared = localStorage.getItem('kbbook-data-cleared') === '1'
      configureDocLoader({
        // If user cleared local data, set baseUrl to an unreachable address so
        // the fetch() fallback in content loaders also fails (APK WebView would
        // otherwise serve assets/ content, defeating the clear).
        baseUrl: dataCleared ? 'http://127.0.0.1:1' : '',
        readLocalDoc: async (path: string) => {
          const result = await readLocalDoc(path)
          // Block APK asset fallback: readDocFromStorage (synced-docs) is empty
          // after clear, native falls back to readDocFromAssets — reject that.
          const cleared = localStorage.getItem('kbbook-data-cleared') === '1'
          if (result.source === 'assets' && cleared) {
            throw new Error('DATA_CLEARED')
          }
          return result.content
        },
      })
    } else {
      configureDocLoader({
        baseUrl: state.networkUrl,
        readLocalDoc: null,
      })
    }
  }, [state.mode, state.networkUrl])

  const switchMode = useCallback(async (mode: 'local' | 'network') => {
    await setMode(mode)
    // Clear JS caches to prevent stale data from previous mode
    await clearAllJsCaches()
    // Increment dataVersion so all components re-fetch data
    setState((s) => ({ ...s, mode, dataVersion: s.dataVersion + 1 }))
  }, [])

  const updateNetworkUrl = useCallback(async (url: string) => {
    await setNetworkUrl(url)
    // Clear JS caches and force re-fetch from new URL
    await clearAllJsCaches()
    setState((s) => ({ ...s, networkUrl: url, dataVersion: s.dataVersion + 1 }))
  }, [])

  /** 增量同步 */
  const triggerSync = useCallback(async (ossCfg?: OssConfig): Promise<SyncResult> => {
    setState((s) => ({ ...s, syncing: true }))
    try {
      const result = await syncFromOSS(ossCfg)
      // Sync succeeded — clear the "data cleared" flag so asset fallback works again
      try { localStorage.removeItem('kbbook-data-cleared') } catch {}
      const status = await getSyncStatus()
      setState((s) => ({ ...s, syncing: false, syncStatus: status, syncResult: result, dataVersion: s.dataVersion + 1 }))
      return result
    } catch (e) {
      setState((s) => ({ ...s, syncing: false, syncResult: null }))
      throw e
    }
  }, [])

  /** 仅清除本地数据（不清除 JS 缓存，不触发同步） */
  const triggerClearLocal = useCallback(async () => {
    setState((s) => ({ ...s, clearing: true }))
    try {
      // 1. Clear JS-side caches
      await clearAllJsCaches()

      // 2. Call native to delete synced-docs + manifest + prefs
      await clearLocalData()

      // 3. Set flag to block APK asset fallback — after reload, content loaders
      //    will see this and refuse to serve built-in assets, showing "no data".
      try { localStorage.setItem('kbbook-data-cleared', '1') } catch {}

      // 4. Re-configure doc loader so _docBaseUrl is set to unreachable address.
      //    The useEffect([mode, networkUrl]) doesn't fire because neither changed,
      //    but _docBaseUrl must reflect the new data-cleared flag.
      configureDocLoader({ baseUrl: 'http://127.0.0.1:1', forceClearCache: true })

      // 5. Refresh sync status (will show empty)
      const status = await getSyncStatus()
      setState((s) => ({ ...s, clearing: false, syncStatus: status, syncResult: null, dataVersion: s.dataVersion + 1 }))
    } catch (e) {
      setState((s) => ({ ...s, clearing: false }))
      throw e
    }
  }, [])

  /** 全量同步：清除+重新下载 */
  const triggerFullReset = useCallback(async (ossCfg?: OssConfig): Promise<SyncResult> => {
    setState((s) => ({ ...s, fullResetting: true }))
    try {
      // 1. Clear all JS-side caches first
      await clearAllJsCaches()

      // 2. Call native: wipe synced-docs + manifest + prefs, then full re-sync
      const result = await resetAndSync(ossCfg)

      // 3. Sync succeeded — clear the "data cleared" flag
      try { localStorage.removeItem('kbbook-data-cleared') } catch {}

      // 4. Re-configure doc loader to reset _docBaseUrl from 'http://127.0.0.1:1'
      //    back to '' (empty) so the fetch() fallback works correctly.  The
      //    useEffect([mode, networkUrl]) does NOT fire because neither changed,
      //    so _docBaseUrl would otherwise stay stale from a prior clearLocalData.
      configureDocLoader({ baseUrl: '', forceClearCache: true })

      // 5. Refresh sync status from native
      const status = await getSyncStatus()
      setState((s) => ({ ...s, fullResetting: false, syncStatus: status, syncResult: result, dataVersion: s.dataVersion + 1 }))
      return result
    } catch (e) {
      setState((s) => ({ ...s, fullResetting: false, syncResult: null }))
      throw e
    }
  }, [])

  /** 模式感知的 .md 文档加载 */
  const loadDoc = useCallback(async (path: string): Promise<string> => {
    if (state.mode === 'local') {
      const result = await readLocalDoc(path)
      return result.content
    }
    // Network mode — use timeout + retry + SPA fallback detection
    const resp = await fetchWithTimeout(`${state.networkUrl}/docs/${path}.md`)
    if (!resp.ok) throw new Error(`Doc not found: ${path} (HTTP ${resp.status})`)
    const text = await resp.text()
    if (isHtmlFallback(resp, text)) {
      throw new Error(`Doc not found (SPA fallback): ${path}`)
    }
    return text
  }, [state.mode, state.networkUrl])

  /** 模式感知的 JSON 加载 */
  const loadJson = useCallback(async (path: string): Promise<any> => {
    if (state.mode === 'local') {
      const result = await readLocalDoc(path.replace(/\.json$/, ''))
      return JSON.parse(result.content)
    }
    const resp = await fetchWithTimeout(`${state.networkUrl}/docs/${path}.json`)
    if (!resp.ok) throw new Error(`JSON not found: ${path} (HTTP ${resp.status})`)
    const text = await resp.text()
    if (isHtmlFallback(resp, text)) {
      throw new Error(`JSON not found (SPA fallback): ${path}`)
    }
    return JSON.parse(text)
  }, [state.mode, state.networkUrl])

  return (
    <DocModeContext.Provider
      value={{ ...state, switchMode, updateNetworkUrl, triggerSync, triggerClearLocal, triggerFullReset, loadDoc, loadJson }}
    >
      {children}
    </DocModeContext.Provider>
  )
}

export function useDocMode(): DocModeContextValue {
  const ctx = useContext(DocModeContext)
  if (!ctx) throw new Error('useDocMode must be used within DocModeProvider')
  return ctx
}
