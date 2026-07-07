/**
 * usePersistentState — SQLite-backed persistent state hook.
 * All reads/writes go through PreferencesRepo. No localStorage.
 */
import { useState, useEffect, useCallback } from 'react'
import { getPreferencesRepo } from '@/data/bridge.js'

const READER_NS = 'kbbook-reader:'

export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (v: T) => boolean,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = READER_NS + key
  const [value, setValue] = useState<T>(initial)
  const [loaded, setLoaded] = useState(false)

  // Load from Repo on mount
  useEffect(() => {
    let cancelled = false
    getPreferencesRepo()?.get<T>(storageKey).then((saved) => {
      if (cancelled || saved == null) return
      if (validate && !validate(saved)) return
      setValue(saved)
      setLoaded(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [storageKey, validate])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try { getPreferencesRepo()?.set(storageKey, resolved) } catch {}
        return resolved
      })
    },
    [storageKey],
  )

  return [loaded ? value : value, set]
}
