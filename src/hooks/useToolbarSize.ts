import { useState, useCallback } from 'react'

const KEY = 'kbbook-toolbar-size'
const MIN = 0.7
const MAX = 1.8
const STEP = 0.1
const DEFAULT = 1

function load(): number {
  try {
    const v = localStorage.getItem(KEY)
    if (v) {
      const n = parseFloat(v)
      if (n >= MIN && n <= MAX) return n
    }
  } catch {}
  return DEFAULT
}

export function useToolbarSize() {
  const [size, setSizeState] = useState(load)

  const setSize = useCallback((s: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(s * 10) / 10))
    setSizeState(clamped)
    try { localStorage.setItem(KEY, String(clamped)) } catch {}
  }, [])

  const increase = useCallback(() => setSize(size + STEP), [size, setSize])
  const decrease = useCallback(() => setSize(size - STEP), [size, setSize])
  const reset = useCallback(() => setSize(DEFAULT), [setSize])

  return { toolbarSize: size, setToolbarSize: setSize, increaseToolbar: increase, decreaseToolbar: decrease, resetToolbar: reset }
}
