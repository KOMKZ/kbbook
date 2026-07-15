/**
 * LZPortalSync Capacitor Plugin — TypeScript 定义
 *
 * 在 Web 环境下（浏览器 dev server）运行时，此插件不可用，
 * 所有方法会走 web fallback，返回合理默认值。
 */

import { registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export interface ReadLocalDocResult {
  content: string
  source: 'synced' | 'assets'
}

export interface SyncProgress {
  stage: 'check' | 'download' | 'extract' | 'done'
  percent: number
  detail: string
}

export interface SyncResult {
  fileCount: number
  totalSize: number
  version: string
  skipped: boolean
  added: number
  updated: number
  deleted: number
}

export interface SyncStatus {
  lastSyncTime: string | null
  syncVersion: string | null
  fileCount: number
  docsAvailable: boolean
}

export interface ModeResult {
  mode: 'local' | 'network'
}

export interface NetworkUrlResult {
  url: string
}

export interface WebUpdateResult {
  updateAvailable: boolean
  version?: string
  fileCount?: number
  reason?: string
}

export interface WebVersionResult {
  version: string
}

export interface LZPortalSyncPlugin {
  readLocalDoc(options: { path: string }): Promise<ReadLocalDocResult>
  syncFromOSS(options?: { endpoint?: string; bucket?: string; path?: string; accessKeyId?: string; accessKeySecret?: string }): Promise<SyncResult>
  resetAndSync(options?: { endpoint?: string; bucket?: string; path?: string; accessKeyId?: string; accessKeySecret?: string }): Promise<SyncResult>
  clearLocalData(): Promise<{ success: boolean }>
  getSyncStatus(): Promise<SyncStatus>
  getMode(): Promise<ModeResult>
  setMode(options: { mode: string }): Promise<void>
  getNetworkUrl(): Promise<NetworkUrlResult>
  setNetworkUrl(options: { url: string }): Promise<void>
  checkWebUpdate(): Promise<WebUpdateResult>
  getWebVersion(): Promise<WebVersionResult>
  addListener(eventName: 'syncProgress', callback: (data: SyncProgress) => void): Promise<PluginListenerHandle>
  saveOssConfig(options: { endpoint?: string; bucket?: string; path?: string; accessKeyId?: string; accessKeySecret?: string }): Promise<void>
  startDebugServer(options: { port: number }): Promise<{ port: number; status: string }>
  stopDebugServer(): Promise<void>
}

const LZPortalSync = registerPlugin<LZPortalSyncPlugin>('LZPortalSync')

// ---- Web fallback (浏览器环境) ----

const isNative = (): boolean => {
  try {
    const Capacitor = (window as any).Capacitor
    return !!(Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform())
  } catch {
    return false
  }
}

export const readLocalDoc = async (path: string): Promise<ReadLocalDocResult> => {
  if (isNative()) {
    return LZPortalSync.readLocalDoc({ path })
  }
  // Web fallback: only append .md if the filename doesn't already have an extension
  // (mirrors the Java plugin's basename check — avoids double extension like series.json.md)
  const lastSlash = path.lastIndexOf('/')
  const baseName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path
  const fetchPath = baseName.includes('.') ? path : path + '.md'
  const resp = await fetch(`/docs/${fetchPath}`)
  if (!resp.ok) throw new Error(`Doc not found: ${path}`)
  return { content: await resp.text(), source: 'assets' }
}

export interface OssConfig {
  endpoint?: string
  bucket?: string
  path?: string
  accessKeyId?: string
  accessKeySecret?: string
}

export const syncFromOSS = async (ossCfg?: OssConfig): Promise<SyncResult> => {
  if (isNative()) {
    // Pass user config to native plugin if provided
    if (ossCfg?.accessKeyId) {
      return LZPortalSync.syncFromOSS(ossCfg)
    }
    return LZPortalSync.syncFromOSS()
  }
  // Web mode: attempt a quick connectivity check with user config
  if (ossCfg?.endpoint && ossCfg?.bucket && ossCfg?.accessKeyId) {
    try {
      const url = `${ossCfg.endpoint}/${ossCfg.bucket}/${ossCfg.path || ''}/manifest.json`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return { fileCount: 0, totalSize: 0, version: 'web-check', skipped: false, added: 0, updated: 0, deleted: 0 }
    } catch (e: any) {
      throw new Error(`OSS 连接失败: ${e.message}. 请检查 OSS 配置 (Endpoint/Bucket/Key)`)
    }
  }
  return { fileCount: 0, totalSize: 0, version: 'web', skipped: true, added: 0, updated: 0, deleted: 0 }
}

/** 全量同步：先清空本地所有数据，再从 OSS 全量重新下载。仅在 Native 环境生效。 */
export const resetAndSync = async (ossCfg?: OssConfig): Promise<SyncResult> => {
  if (isNative()) {
    if (ossCfg?.accessKeyId) {
      return LZPortalSync.resetAndSync(ossCfg)
    }
    return LZPortalSync.resetAndSync()
  }
  // Web mode: not applicable — clear cache + reload will suffice
  return { fileCount: 0, totalSize: 0, version: 'web', skipped: true, added: 0, updated: 0, deleted: 0 }
}

/** 仅清除本地数据（不触发同步）。删除 synced-docs/、manifest、sync prefs。 */
export const clearLocalData = async (): Promise<{ success: boolean }> => {
  if (isNative()) {
    return LZPortalSync.clearLocalData()
  }
  return { success: true }
}

export const listenSyncProgress = (
  callback: (data: SyncProgress) => void,
): (() => void) | null => {
  if (!isNative()) return null
  let handle: PluginListenerHandle | null = null
  LZPortalSync.addListener('syncProgress', callback).then((h) => {
    handle = h
  })
  return () => {
    handle?.remove()
  }
}

export const getSyncStatus = async (): Promise<SyncStatus> => {
  if (isNative()) return LZPortalSync.getSyncStatus()
  return { lastSyncTime: null, syncVersion: null, fileCount: 0, docsAvailable: false }
}

export const getMode = async (): Promise<string> => {
  const stored = localStorage.getItem('lz-portal-mode')
  if (stored === 'local' || stored === 'network') return stored
  if (isNative()) {
    try {
      const result = await LZPortalSync.getMode()
      return result.mode
    } catch { /* fall through */ }
  }
  return 'local'
}

export const setMode = async (mode: 'local' | 'network'): Promise<void> => {
  localStorage.setItem('lz-portal-mode', mode)
  if (isNative()) {
    try { await LZPortalSync.setMode({ mode }) } catch { /* ignore */ }
  }
}

export const getNetworkUrl = async (): Promise<string> => {
  const stored = localStorage.getItem('kbbook-network-url')
  if (stored) return stored
  if (isNative()) {
    try {
      const result = await LZPortalSync.getNetworkUrl()
      return result.url
    } catch { /* fall through */ }
  }
  return 'http://localhost:3004'
}

export const setNetworkUrl = async (url: string): Promise<void> => {
  localStorage.setItem('kbbook-network-url', url)
  if (isNative()) {
    try { await LZPortalSync.setNetworkUrl({ url }) } catch { /* ignore */ }
  }
}

export const checkWebUpdate = async (): Promise<WebUpdateResult> => {
  if (isNative()) return LZPortalSync.checkWebUpdate()
  return { updateAvailable: false, reason: 'Not in app' }
}

export const saveOssConfig = async (cfg: OssConfig): Promise<void> => {
  if (isNative()) {
    await LZPortalSync.saveOssConfig(cfg)
  }
  // Web mode: no-op (config stored in localStorage by caller)
}

export const getWebVersion = async (): Promise<string> => {
  if (isNative()) {
    try { const r = await LZPortalSync.getWebVersion(); return r.version } catch { return '0' }
  }
  return '0'
}

// === Debug HTTP Server ===

export const startDebugServer = async (port = 9123): Promise<{ port: number; status: string }> => {
  if (isNative()) return LZPortalSync.startDebugServer({ port })
  return { port, status: 'web-skipped' }
}

export const stopDebugServer = async (): Promise<void> => {
  if (isNative()) { try { await LZPortalSync.stopDebugServer() } catch {} }
}
