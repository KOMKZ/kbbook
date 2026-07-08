import { useCallback, useState } from 'react'

/**
 * 通用「记忆」hook —— 把一份状态持久化到 localStorage,刷新/重开后自动恢复。
 *
 * 设计为阅读器(及未来更多功能)共用的记忆基建:
 * 新增任何需要记住的设置(行宽、主题、朗读语速、上次阅读位置 ...)时,
 * 直接 `usePersistentState('someKey', defaultValue)` 即可,无需各自手写 localStorage 读写。
 *
 * - 所有 key 统一加 `READER_NS` 前缀,避免与其它存储冲突。
 * - 值用 JSON 序列化,支持 number / string / boolean / 对象。
 * - 读/写异常(隐私模式、配额满、坏数据)全部静默降级到内存态,不影响功能。
 * - 可选 `validate` 用于过滤越界/损坏的历史值。
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
        try {
          localStorage.setItem(storageKey, JSON.stringify(resolved))
        } catch {
          // 静默降级:仅保留内存态
        }
        return resolved
      })
    },
    [storageKey],
  )

  return [value, set]
}
