import { useState, useCallback } from 'react'
import type { HighlightItem, HighlightColor, HighlightApiAdapter } from '../../data/highlight/types'

export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange']

export const COLOR_BG: Record<HighlightColor, string> = {
  yellow: 'rgba(250,204,21,0.4)',
  green: 'rgba(74,222,128,0.4)',
  blue: 'rgba(96,165,250,0.4)',
  pink: 'rgba(244,114,182,0.4)',
  orange: 'rgba(251,146,60,0.4)',
}

export const COLOR_CLASS: Record<HighlightColor, string> = {
  yellow: 'hl-y', green: 'hl-g', blue: 'hl-b', pink: 'hl-p', orange: 'hl-o',
}

interface UseHighlightOptions {
  api: HighlightApiAdapter | null
  sourceType: string
  sourceKey: string
}

export function useHighlight({ api, sourceType, sourceKey }: UseHighlightOptions) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([])
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow')
  const [brushMode, setBrushMode] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  /** Load highlights from API for current source. */
  const load = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const result = await api.listHighlights({ source_type: sourceType, source_key: sourceKey })
      setHighlights(result.items || [])
    } catch (e) { console.error('[useHighlight] load failed', e) }
    finally { setLoading(false) }
  }, [api, sourceType, sourceKey])

  /** Create a new highlight from selected text. */
  const create = useCallback(async (text: string, rangeJson: string) => {
    if (!api) return null
    try {
      const item = await api.createHighlight({
        source_type: sourceType, source_key: sourceKey,
        color: activeColor, text, serialized_range: rangeJson,
        sort_order: highlights.length,
      })
      setHighlights(prev => [...prev, item])
      return item
    } catch (e) { console.error('[useHighlight] create failed', e); return null }
  }, [api, sourceType, sourceKey, activeColor, highlights.length])

  /** Update color / note / sort_order. */
  const update = useCallback(async (id: number, data: Partial<Pick<HighlightItem, 'color' | 'note' | 'sort_order'>>) => {
    if (!api) return
    try {
      await api.updateHighlight(id, data)
      setHighlights(prev => prev.map(h => h.id === id ? { ...h, ...data } : h))
    } catch (e) { console.error('[useHighlight] update failed', e) }
  }, [api])

  /** Delete single highlight. */
  const remove = useCallback(async (id: number) => {
    if (!api) return
    try {
      await api.deleteHighlight(id)
      setHighlights(prev => prev.filter(h => h.id !== id))
    } catch (e) { console.error('[useHighlight] remove failed', e) }
  }, [api])

  /** Copy all highlight texts. */
  const copyAll = useCallback(async (): Promise<string> => {
    if (!api) return ''
    try {
      const result = await api.copyText({ source_type: sourceType, source_key: sourceKey })
      return result.text
    } catch (e) { console.error('[useHighlight] copyAll failed', e); return '' }
  }, [api, sourceType, sourceKey])

  /** Delete all highlights for current source. */
  const clearAll = useCallback(async () => {
    if (!api) return
    try {
      await api.batchDelete({ source_type: sourceType, source_key: sourceKey })
      setHighlights([])
    } catch (e) { console.error('[useHighlight] clearAll failed', e) }
  }, [api, sourceType, sourceKey])

  // ── Note editing ──
  const startEdit = useCallback((id: number) => {
    const h = highlights.find(x => x.id === id)
    setEditingId(id)
    setEditingText(h?.note || '')
  }, [highlights])

  const saveNote = useCallback(async () => {
    if (editingId === null) return
    await update(editingId, { note: editingText })
    setEditingId(null)
    setEditingText('')
  }, [editingId, editingText, update])

  const cancelNote = useCallback(() => {
    setEditingId(null)
    setEditingText('')
  }, [])

  // ── Serialize selection range to JSON string ──
  const serializeRange = useCallback((range: Range): string => {
    function nodePath(node: Node, root: Node): string {
      const path: number[] = []
      let n: Node | null = node
      while (n && n !== root) {
        const parent: Node | null = n.parentNode
        if (!parent) break
        let idx = 0
        for (let c = parent.firstChild; c && c !== n; c = c.nextSibling) idx++
        path.unshift(idx)
        n = parent
      }
      return path.join(',')
    }
    return JSON.stringify({
      startPath: nodePath(range.startContainer, range.commonAncestorContainer),
      startOffset: range.startOffset,
      endPath: nodePath(range.endContainer, range.commonAncestorContainer),
      endOffset: range.endOffset,
    })
  }, [])

  return {
    highlights, activeColor, brushMode, panelOpen, loading,
    editingId, editingText,
    setActiveColor, setBrushMode, setPanelOpen,
    load, create, update, remove, copyAll, clearAll,
    startEdit, saveNote, cancelNote, setEditingText,
    serializeRange,
  }
}
