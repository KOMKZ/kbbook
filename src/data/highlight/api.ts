/**
 * Highlight API adapter — HTTP calls to rong-admin-api /api/v1/highlights.
 * Accepts a fetch-like httpClient for portability (works with both browser fetch and Capacitor HTTP).
 */

import type { HighlightApiAdapter, HighlightSourceQuery, CreateHighlightInput, HighlightItem } from './types'

const BASE = '/api/v1/highlights'

/** Create an API adapter using a minimal http client interface. */
export function createHighlightApi(http: {
  get: <T>(url: string, params?: Record<string, string | number>) => Promise<T>
  post: <T>(url: string, data: unknown) => Promise<T>
  put: <T>(url: string, data: unknown) => Promise<T>
  delete: <T>(url: string) => Promise<T>
  request: <T>(opts: { url: string; method: string; data?: unknown }) => Promise<T>
}): HighlightApiAdapter {
  return {
    async listHighlights(query: HighlightSourceQuery): Promise<{ items: HighlightItem[] }> {
      const params: Record<string, string | number> = {
        source_type: query.source_type,
        source_key: query.source_key,
      }
      if (query.source_id !== undefined) params.source_id = query.source_id
      return http.get<{ items: HighlightItem[] }>(BASE, params)
    },

    async createHighlight(input: CreateHighlightInput): Promise<HighlightItem> {
      return http.post<HighlightItem>(BASE, input)
    },

    async updateHighlight(id: number, data: Partial<Pick<HighlightItem, 'color' | 'note' | 'sort_order'>>): Promise<void> {
      await http.put<unknown>(`${BASE}/${id}`, data)
    },

    async deleteHighlight(id: number): Promise<void> {
      await http.delete<unknown>(`${BASE}/${id}`)
    },

    async copyText(query: HighlightSourceQuery): Promise<{ text: string }> {
      return http.post<{ text: string }>(`${BASE}/copy-text`, query)
    },

    async batchDelete(query: HighlightSourceQuery): Promise<void> {
      await http.request<unknown>({ url: `${BASE}/batch`, method: 'DELETE', data: query })
    },
  }
}

/**
 * Browser-native fetch adapter.
 * In Capacitor WebView, use Capacitor HTTP plugin instead for CORS-free requests.
 */
export const fetchHttpClient = {
  async get<T>(url: string, params?: Record<string, string | number>): Promise<T> {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : ''
    const resp = await fetch(url + qs)
    if (!resp.ok) throw new Error(`GET ${url}: ${resp.status}`)
    return resp.json()
  },
  async post<T>(url: string, data: unknown): Promise<T> {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!resp.ok) throw new Error(`POST ${url}: ${resp.status}`)
    return resp.json()
  },
  async put<T>(url: string, data: unknown): Promise<T> {
    const resp = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!resp.ok) throw new Error(`PUT ${url}: ${resp.status}`)
    return resp.json()
  },
  async delete<T>(url: string): Promise<T> {
    const resp = await fetch(url, { method: 'DELETE' })
    if (!resp.ok) throw new Error(`DELETE ${url}: ${resp.status}`)
    return resp.json()
  },
  async request<T>(opts: { url: string; method: string; data?: unknown }): Promise<T> {
    const resp = await fetch(opts.url, {
      method: opts.method,
      headers: opts.data ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.data ? JSON.stringify(opts.data) : undefined,
    })
    if (!resp.ok) throw new Error(`${opts.method} ${opts.url}: ${resp.status}`)
    return resp.json()
  },
}
