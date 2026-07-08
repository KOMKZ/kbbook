import { useCallback, useState } from 'react'
import type { Series } from '../types/series'

const ORDER_KEY = 'kbbook-series-order'

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  } catch {
    // 静默降级
  }
}

function applyOrder(rawList: Series[], saved: string[]): Series[] {
  const idMap = new Map(rawList.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const result: Series[] = []

  for (const id of saved) {
    const s = idMap.get(id)
    if (s && !seen.has(id)) {
      seen.add(id)
      result.push(s)
    }
  }
  for (const s of rawList) {
    if (!seen.has(s.id)) {
      result.push(s)
    }
  }
  return result
}

/**
 * 系列排序 hook。
 *
 * 核心思路：`savedOrder` 是唯一的排序真相源(localStorage)。orderedSeries 直接派生自 seriesList + savedOrder。
 * 拖拽后立即写 localStorage 并更新 savedOrder 状态，list 自动重新派生。
 */
export function useSeriesOrder(rawList: Series[]): [Series[], (fromIndex: number, toIndex: number) => void] {
  const [savedOrder, setSavedOrder] = useState<string[]>(() => loadOrder() || [])

  let orderedSeries: Series[]
  if (savedOrder.length === 0 || rawList.length === 0) {
    orderedSeries = rawList
  } else {
    orderedSeries = applyOrder(rawList, savedOrder)
  }

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setSavedOrder((prevOrder) => {
      const base = prevOrder.length > 0 ? prevOrder : rawList.map((s) => s.id)
      const next = [...base]
      const [id] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, id)
      saveOrder(next)
      return next
    })
  }, [rawList])

  return [orderedSeries, reorder]
}
