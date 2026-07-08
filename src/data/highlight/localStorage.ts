/**
 * localStorage-based HighlightApiAdapter for local development.
 * Swappable with the HTTP adapter when backend is available.
 */

import type { HighlightApiAdapter, HighlightItem, HighlightSourceQuery, CreateHighlightInput } from './types'

const STORE_KEY = 'kbbook-highlights'

function loadAll(): HighlightItem[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveAll(items: HighlightItem[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items))
}

let nextId = (loadAll().reduce((max, h) => Math.max(max, h.id), 0)) + 1

export const localStorageHighlightApi: HighlightApiAdapter = {
  async listHighlights(query: HighlightSourceQuery) {
    const all = loadAll().filter(h =>
      h.source_type === query.source_type && h.source_key === query.source_key
    ).sort((a, b) => a.sort_order - b.sort_order)
    return { items: all }
  },

  async createHighlight(input: CreateHighlightInput) {
    const all = loadAll()
    const now = new Date().toISOString()
    const item: HighlightItem = {
      id: nextId++, source_type: input.source_type, source_id: input.source_id,
      source_key: input.source_key, color: input.color, text: input.text,
      note: input.note || '', serialized_range: input.serialized_range,
      sort_order: input.sort_order, created_at: now, updated_at: now,
    }
    all.push(item)
    saveAll(all)
    return item
  },

  async updateHighlight(id: number, data: Partial<Pick<HighlightItem, 'color' | 'note' | 'sort_order'>>) {
    const all = loadAll()
    const idx = all.findIndex(h => h.id === id)
    if (idx >= 0) {
      Object.assign(all[idx], data, { updated_at: new Date().toISOString() })
      saveAll(all)
    }
  },

  async deleteHighlight(id: number) {
    saveAll(loadAll().filter(h => h.id !== id))
  },

  async copyText(query: HighlightSourceQuery) {
    const items = loadAll().filter(h =>
      h.source_type === query.source_type && h.source_key === query.source_key
    ).sort((a, b) => a.sort_order - b.sort_order)
    return { text: items.map(h => `${h.text}${h.note ? '\n  > ' + h.note : ''}`).join('\n\n') }
  },

  async batchDelete(query: HighlightSourceQuery) {
    saveAll(loadAll().filter(h =>
      !(h.source_type === query.source_type && h.source_key === query.source_key)
    ))
  },
}
