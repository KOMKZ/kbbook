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
  syncFromOSS(): Promise<SyncResult>
  getSyncStatus(): Promise<SyncStatus>
  getMode(): Promise<ModeResult>
  setMode(options: { mode: string }): Promise<void>
  getNetworkUrl(): Promise<NetworkUrlResult>
  setNetworkUrl(options: { url: string }): Promise<void>
  checkWebUpdate(): Promise<WebUpdateResult>
  getWebVersion(): Promise<WebVersionResult>
  addListener(eventName: 'syncProgress', callback: (data: SyncProgress) => void): Promise<PluginListenerHandle>
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
  const resp = await fetch(`/docs/${path}.md`)
  if (!resp.ok) throw new Error(`Doc not found: ${path}`)
  return { content: await resp.text(), source: 'assets' }
}

export const syncFromOSS = async (): Promise<SyncResult> => {
  if (isNative()) return LZPortalSync.syncFromOSS()
  return { fileCount: 0, totalSize: 0, version: 'web', skipped: true, added: 0, updated: 0, deleted: 0 }
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

export const getWebVersion = async (): Promise<string> => {
  if (isNative()) {
    try { const r = await LZPortalSync.getWebVersion(); return r.version } catch { return '0' }
  }
  return '0'
}
