import { useCallback, useState } from 'react'
import { getPreferencesRepo } from '@/data/bridge.js'

/**
 * 通用「记忆」hook —— localStorage 持久化 + SQLite PreferencesRepo 双写。
 *
 * - 所有 key 统一加 `READER_NS` 前缀。
 * - 读取：仅 localStorage（启动时 Repo 可能尚未就绪）。
 * - 写入：localStorage + PreferencesRepo（如果已就绪）双写。
 */

const READER_NS = 'kbbook-reader:'

export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (v: T) => boolean,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = READER_NS + key

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw == null) return initial
      const parsed = JSON.parse(raw) as T
      if (validate && !validate(parsed)) return initial
      return parsed
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        // Write localStorage (always)
        try {
          localStorage.setItem(storageKey, JSON.stringify(resolved))
        } catch { /* silent */ }
        // Write Repo (if available)
        try {
          getPreferencesRepo()?.set(storageKey, resolved)
        } catch { /* silent */ }
        return resolved
      })
    },
    [storageKey],
  )

  return [value, set]
}
