/**
 * useMermaidCache — tablet/mobile only: hash-based IndexedDB cache for mermaid PNGs.
 * On PC (web), falls through to SVG rendering (no caching).
 *
 * Flow:
 *   1. Detect platform (isNative = Capacitor tablet/phone)
 *   2. Hash mermaid source → check IndexedDB
 *   3. Cache hit → return PNG blob URL
 *   4. Cache miss → render SVG normally, then async: SVG → canvas → PNG → IndexedDB
 */

import { useRef, useCallback } from 'react'

let _addDebug: ((mod: string, msg: string) => void) | null = null
async function addDebug(mod: string, msg: string) {
  if (!_addDebug) {
    try {
      const m = await import('../../utils/debug.js')
      _addDebug = m.debugLog.info.bind(m.debugLog)
    } catch { _addDebug = () => {} }
  }
  _addDebug(mod, msg)
}

const DB_NAME = 'kbbook-mermaid-cache'
const DB_VERSION = 1
const STORE = 'pngs'

let _dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

/** Simple SHA-256 hash of a string → hex (first 16 chars for key). */
async function hashString(s: string): Promise<string> {
  const data = new TextEncoder().encode(s)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

/** Store PNG blob in IndexedDB. */
async function cachePut(key: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Get PNG blob from IndexedDB. Returns null on miss. */
async function cacheGet(key: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Convert SVG text to PNG Blob via canvas. */
function svgToPngBlob(svgText: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = Math.max(2, (window.devicePixelRatio || 2) * 2) // 2x minimum, 4x on 2x screens
    const img = new Image()
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no 2d context')); return }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('toBlob failed'))
      }, 'image/png', 1.0) // max quality
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg load failed')) }
    img.src = url
  })
}

/** Check if running on Capacitor tablet/phone. */
function isNative(): boolean {
  try {
    // Multiple detection methods for robustness
    const w = window as any
    // Method 1: Capacitor API
    if (w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function' && w.Capacitor.isNativePlatform()) return true
    // Method 2: Capacitor user agent
    if (w.Capacitor?.getPlatform?.() === 'android' || w.Capacitor?.getPlatform?.() === 'ios') return true
    // Method 3: Cordova/PhoneGap
    if (!!w.cordova) return true
    return false
  } catch { return false }
}

/** Get platform display string for debugging. */
export function getPlatformLabel(): string {
  try {
    const w = window as any
    if (w.Capacitor?.getPlatform) return `Capacitor/${w.Capacitor.getPlatform()}`
    if (w.Capacitor) return 'Capacitor/web'
    if (w.cordova) return 'Cordova'
  } catch {}
  return navigator.userAgent.includes('Android') ? 'Android/WebView' : 'PC/Browser'
}

export function useMermaidCache() {
  const cache = useRef(new Map<string, string>()) // hash → blob URL (prevents duplicate work)
  const converting = useRef(new Set<string>()) // hashes currently being converted

  /**
   * Get mermaid PNG for a given source string.
   * Returns blob URL on cache hit, null if need to render SVG first.
   */
  const getMermaidPng = useCallback(async (src: string): Promise<string | null> => {
    // PC mode: never use cache — always render SVG
    if (!isNative()) return null

    const hash = await hashString(src)
    // Check in-memory cache first
    if (cache.current.has(hash)) {
      addDebug('mermaid-cache', `in-memory hit: ${hash}`)
      return cache.current.get(hash)!
    }

    // Check IndexedDB
    try {
      const blob = await cacheGet(hash)
      if (blob) {
        const url = URL.createObjectURL(blob)
        cache.current.set(hash, url)
        addDebug('mermaid-cache', `IDB hit: ${hash} (${blob.size} bytes)`)
        return url
      }
      addDebug('mermaid-cache', `IDB miss: ${hash}`)
    } catch (e: any) {
      addDebug('mermaid-cache', `IDB error: ${e.message}`)
    }
    return null
  }, [])

  /**
   * Convert SVG to PNG and cache it (called after SVG is rendered to DOM).
   * Safe to call multiple times — deduplicates via converting set.
   */
  const cacheSvgLater = useCallback(async (src: string, svgText: string) => {
    if (!isNative()) return
    const hash = await hashString(src)
    if (cache.current.has(hash) || converting.current.has(hash)) return
    converting.current.add(hash)
    addDebug('mermaid-cache', `converting SVG→PNG: ${hash} (${svgText.length} chars)`)
    try {
      const blob = await svgToPngBlob(svgText)
      addDebug('mermaid-cache', `PNG ready: ${hash} → ${blob.size} bytes`)
      await cachePut(hash, blob)
      addDebug('mermaid-cache', `IDB saved: ${hash}`)
      const url = URL.createObjectURL(blob)
      cache.current.set(hash, url)
    } catch (e: any) {
      addDebug('mermaid-cache', `conversion failed: ${e.message}`)
    } finally {
      converting.current.delete(hash)
    }
  }, [])

  return { getMermaidPng, cacheSvgLater, isNative: isNative() }
}
