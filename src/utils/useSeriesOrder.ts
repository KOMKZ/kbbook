/**
 * useSeriesOrder — in-memory series ordering.
 * Order comes from series.json (canonical), drag reorder is temporary until persisted via SeriesRepo.
 */
import { useCallback, useState } from 'react'
import type { Series } from '../types/series'

export function useSeriesOrder(seriesList: Series[]): [Series[], (oldIndex: number, newIndex: number) => void] {
  const [order, setOrder] = useState<string[] | null>(null)

  const effectiveOrder = order && order.length === seriesList.length
    ? order
    : seriesList.map((s) => s.id)

  const orderedSeries = effectiveOrder
    .map((id) => seriesList.find((s) => s.id === id))
    .filter((s): s is Series => !!s)

  // Include any series not in the order
  for (const s of seriesList) {
    if (!effectiveOrder.includes(s.id)) {
      orderedSeries.push(s)
    }
  }

  const reorderSeries = useCallback((oldIndex: number, newIndex: number) => {
    setOrder((prev) => {
      const list = [...(prev || seriesList.map((s) => s.id))]
      const [moved] = list.splice(oldIndex, 1)
      list.splice(newIndex, 0, moved)
      return list
    })
  }, [seriesList])

  return [orderedSeries, reorderSeries]
}
