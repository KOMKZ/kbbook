import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'kbbook-reading-history'
const MAX_ITEMS = 50

export interface HistoryEntry {
  slug: string
  title: string
  seriesId: string
  timestamp: number
}

function loadAll(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as HistoryEntry[]
  } catch {}
  return []
}

function saveAll(items: HistoryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

export function useReadingHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([])

  useEffect(() => { setItems(loadAll()) }, [])

  const addEntry = useCallback((slug: string, title: string, seriesId: string) => {
    if (!slug || !title) return
    setItems((prev) => {
      const filtered = prev.filter((e) => e.slug !== slug)
      const entry: HistoryEntry = { slug, title, seriesId, timestamp: Date.now() }
      const next = [entry, ...filtered].slice(0, MAX_ITEMS)
      saveAll(next)
      return next
    })
  }, [])

  const removeEntry = useCallback((slug: string) => {
    setItems((prev) => {
      const next = prev.filter((e) => e.slug !== slug)
      saveAll(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    saveAll([])
  }, [])

  return { items, addEntry, removeEntry, clearAll }
}
