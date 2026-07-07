/**
 * useReadingHistory — SQLite-backed reading history.
 * All reads/writes via ReadingHistoryRepo. No localStorage.
 */
import { useState, useEffect, useCallback } from 'react'
import { getDriver } from '@/data/bridge.js'
import { ReadingHistoryRepo } from '@/data/repo/reading.js'

export interface HistoryEntry {
  slug: string
  title: string
  seriesId: string
  timestamp: number
}

export function useReadingHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([])

  useEffect(() => {
    let cancelled = false
    const driver = getDriver()
    if (!driver) return
    const repo = new ReadingHistoryRepo(driver)
    repo.getRecent(50).then((entries) => {
      if (!cancelled) setItems(entries.map((e) => ({
        slug: e.slug, title: e.title || e.slug,
        seriesId: e.seriesId, timestamp: e.readAt,
      })))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const addEntry = useCallback((slug: string, title: string, seriesId: string) => {
    if (!slug || !title) return
    const driver = getDriver()
    if (!driver) return
    const repo = new ReadingHistoryRepo(driver)
    repo.addEntry(slug, seriesId, title).then(() => {
      repo.getRecent(50).then((entries) => {
        setItems(entries.map((e) => ({
          slug: e.slug, title: e.title || e.slug,
          seriesId: e.seriesId, timestamp: e.readAt,
        })))
      }).catch(() => {})
    }).catch(() => {})
  }, [])

  const removeEntry = useCallback((slug: string) => {
    const driver = getDriver()
    if (!driver) return
    const repo = new ReadingHistoryRepo(driver)
    repo.removeEntry(slug).then(() => {
      setItems((prev) => prev.filter((e) => e.slug !== slug))
    }).catch(() => {})
  }, [])

  const clearAll = useCallback(() => {
    const driver = getDriver()
    if (!driver) return
    const repo = new ReadingHistoryRepo(driver)
    repo.clear().then(() => setItems([])).catch(() => {})
  }, [])

  return { items, addEntry, removeEntry, clearAll }
}
