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
function svgToPngBlob(svgText: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
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
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('toBlob failed'))
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg load failed')) }
    img.src = url
  })
}

/** Check if running on Capacitor tablet/phone. */
function isNative(): boolean {
  try {
    const c = (window as any).Capacitor
    return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform())
  } catch { return false }
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
    if (cache.current.has(hash)) return cache.current.get(hash)!

    // Check IndexedDB
    const blob = await cacheGet(hash)
    if (blob) {
      const url = URL.createObjectURL(blob)
      cache.current.set(hash, url)
      return url
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
    try {
      const blob = await svgToPngBlob(svgText)
      await cachePut(hash, blob)
      const url = URL.createObjectURL(blob)
      // Don't replace existing DOM — next page load will use cache
      cache.current.set(hash, url)
    } catch (e) {
      console.warn('[MermaidCache] conversion failed', e)
    } finally {
      converting.current.delete(hash)
    }
  }, [])

  return { getMermaidPng, cacheSvgLater, isNative: isNative() }
}
