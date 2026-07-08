/** Highlight / Note data model — portable from rong-admin-ui docs-browser. */

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface HighlightItem {
  id: number
  source_type: string
  source_id?: number
  source_key: string
  color: string
  text: string
  note: string
  serialized_range: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HighlightSourceQuery {
  source_type: string
  source_id?: number
  source_key: string
}

export interface CreateHighlightInput {
  source_type: string
  source_id?: number
  source_key: string
  color: string
  text: string
  note?: string
  serialized_range: string
  sort_order: number
}

export interface HighlightApiAdapter {
  listHighlights: (query: HighlightSourceQuery) => Promise<{ items: HighlightItem[] }>
  createHighlight: (input: CreateHighlightInput) => Promise<HighlightItem>
  updateHighlight: (id: number, data: Partial<Pick<HighlightItem, 'color' | 'note' | 'sort_order'>>) => Promise<void>
  deleteHighlight: (id: number) => Promise<void>
  copyText: (query: HighlightSourceQuery) => Promise<{ text: string }>
  batchDelete: (query: HighlightSourceQuery) => Promise<void>
}
