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
  readLocalDoc,
  type SyncStatus,
  type SyncResult,
  type OssConfig,
} from '../plugins/lz-portal-sync'
import { configureDocLoader } from '../utils/docs'

interface DocModeState {
  mode: 'local' | 'network'
  networkUrl: string
  syncStatus: SyncStatus
  syncing: boolean
  syncResult: SyncResult | null
}

interface DocModeContextValue extends DocModeState {
  switchMode: (mode: 'local' | 'network') => Promise<void>
  updateNetworkUrl: (url: string) => Promise<void>
  triggerSync: (ossCfg?: OssConfig) => Promise<SyncResult>
  /** 模式感知的文档加载: 本地=插件读, 网络=fetch */
  loadDoc: (path: string) => Promise<string>
  loadJson: (path: string) => Promise<any>
}

const DocModeContext = createContext<DocModeContextValue | null>(null)

declare const __NETWORK_URL__: string
const DEFAULT_NETWORK_URL = (typeof __NETWORK_URL__ !== 'undefined' && __NETWORK_URL__) || 'http://localhost:3004'

export function DocModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DocModeState>({
    mode: 'local',
    networkUrl: DEFAULT_NETWORK_URL,
    syncStatus: { lastSyncTime: null, syncVersion: null, fileCount: 0, docsAvailable: false },
    syncing: false,
    syncResult: null,
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
      configureDocLoader({
        baseUrl: '',
        readLocalDoc: async (path: string) => {
          const result = await readLocalDoc(path)
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
    setState((s) => ({ ...s, mode }))
  }, [])

  const updateNetworkUrl = useCallback(async (url: string) => {
    await setNetworkUrl(url)
    setState((s) => ({ ...s, networkUrl: url }))
  }, [])

  const triggerSync = useCallback(async (ossCfg?: OssConfig): Promise<SyncResult> => {
    setState((s) => ({ ...s, syncing: true }))
    try {
      const result = await syncFromOSS(ossCfg)
      const status = await getSyncStatus()
      setState((s) => ({ ...s, syncing: false, syncStatus: status, syncResult: result }))
      return result
    } catch (e) {
      setState((s) => ({ ...s, syncing: false, syncResult: null }))
      throw e
    }
  }, [])

  /** 模式感知的 .md 文档加载 */
  const loadDoc = useCallback(async (path: string): Promise<string> => {
    if (state.mode === 'local') {
      const result = await readLocalDoc(path)
      return result.content
    }
    // Network mode
    const resp = await fetch(`${state.networkUrl}/docs/${path}.md`)
    if (!resp.ok) throw new Error(`Doc not found: ${path}`)
    return resp.text()
  }, [state.mode, state.networkUrl])

  /** 模式感知的 JSON 加载 */
  const loadJson = useCallback(async (path: string): Promise<any> => {
    if (state.mode === 'local') {
      const result = await readLocalDoc(path.replace(/\.json$/, ''))
      return JSON.parse(result.content)
    }
    const resp = await fetch(`${state.networkUrl}/docs/${path}.json`)
    if (!resp.ok) throw new Error(`JSON not found: ${path}`)
    return resp.json()
  }, [state.mode, state.networkUrl])

  return (
    <DocModeContext.Provider
      value={{ ...state, switchMode, updateNetworkUrl, triggerSync, loadDoc, loadJson }}
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
