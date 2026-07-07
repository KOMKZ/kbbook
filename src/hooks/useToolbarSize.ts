import { useState, useCallback } from 'react'

const MIN = 0.7
const MAX = 1.8
const STEP = 0.1
const DEFAULT = 1

export function useToolbarSize() {
  const [size, setSizeState] = useState(DEFAULT)

  const setSize = useCallback((s: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(s * 10) / 10))
    setSizeState(clamped)
  }, [])

  const increase = useCallback(() => setSize(size + STEP), [size, setSize])
  const decrease = useCallback(() => setSize(size - STEP), [size, setSize])
  const reset = useCallback(() => setSize(DEFAULT), [setSize])

  return { toolbarSize: size, setToolbarSize: setSize, increaseToolbar: increase, decreaseToolbar: decrease, resetToolbar: reset }
}
