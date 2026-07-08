import { useState, useCallback, useRef, useEffect } from 'react'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 5
const ZOOM_STEP = 0.15

export function useMermaidZoom() {
  const [fullscreenSvg, setFullscreenSvg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(100)

  // Direct DOM refs — bypass React for transform updates (avoids per-frame reconciliation)
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 })
  const dragRef = useRef({ startX: 0, startY: 0, px0: 0, py0: 0, raf: 0 })

  const applyTransform = useCallback(() => {
    if (!contentRef.current) return
    const { zoom, panX, panY } = transformRef.current
    contentRef.current.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`
  }, [])

  const fitSvgToCanvas = useCallback(() => {
    if (!canvasRef.current) return
    const svg = canvasRef.current.querySelector('svg')
    if (!svg) return
    const vb = svg.getAttribute('viewBox')
    if (!vb) return
    const parts = vb.split(/[\s,]+/)
    if (parts.length < 4) return
    const sw = parseFloat(parts[2]), sh = parseFloat(parts[3]), pad = 48
    const rect = canvasRef.current.getBoundingClientRect()
    const m = 48
    const fit = Math.min((rect.width - m * 2) / (sw + pad), (rect.height - m * 2) / (sh + pad), 1.5)
    transformRef.current = { zoom: fit, panX: -(sw + pad) * fit / 2, panY: -(sh + pad) * fit / 2 }
    setZoomPercent(Math.round(fit * 100))
    applyTransform()
  }, [applyTransform])

  const openFullscreen = useCallback((el: SVGElement) => {
    const clone = el.cloneNode(true) as SVGElement
    let s = clone.getAttribute('style') || ''
    s = s.replace(/position\s*:\s*[^;]+;?/gi, '').replace(/max-width\s*:\s*[^;]+;?/gi, '')
    clone.setAttribute('style', s)
    const vb = clone.getAttribute('viewBox')
    if (vb) { const p = vb.split(/[\s,]+/); if (p.length >= 4) { clone.setAttribute('width', p[2]); clone.setAttribute('height', p[3]) } }
    setFullscreenSvg(clone.outerHTML)
    transformRef.current = { zoom: 1, panX: 0, panY: 0 }
    setZoomPercent(100)
    requestAnimationFrame(() => requestAnimationFrame(fitSvgToCanvas))
  }, [fitSvgToCanvas])

  const closeFullscreen = useCallback(() => {
    setFullscreenSvg(null)
  }, [])

  // Zoom — apply directly to DOM, only update % for display
  const zoomIn = useCallback(() => {
    const t = transformRef.current
    t.zoom = Math.min(ZOOM_MAX, t.zoom * (1 + ZOOM_STEP))
    setZoomPercent(Math.round(t.zoom * 100))
    applyTransform()
  }, [applyTransform])

  const zoomOut = useCallback(() => {
    const t = transformRef.current
    t.zoom = Math.max(ZOOM_MIN, t.zoom * (1 - ZOOM_STEP))
    setZoomPercent(Math.round(t.zoom * 100))
    applyTransform()
  }, [applyTransform])

  const resetView = useCallback(() => fitSvgToCanvas(), [fitSvgToCanvas])

  // Wheel zoom — direct DOM, RAF-throttled
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top
    const t = transformRef.current
    const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.zoom * factor))
    const r = nz / t.zoom
    t.panX = cx - r * (cx - t.panX)
    t.panY = cy - r * (cy - t.panY)
    t.zoom = nz
    setZoomPercent(Math.round(nz * 100))
    applyTransform()
  }, [applyTransform])

  // Drag — direct DOM, bypass React state
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    const t = transformRef.current
    dragRef.current = { startX: e.clientX, startY: e.clientY, px0: t.panX, py0: t.panY, raf: 0 }
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    setIsDragging(true)
    const t = transformRef.current
    dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, px0: t.panX, py0: t.panY, raf: 0 }
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (dx: number, dy: number) => {
      const { px0, py0 } = dragRef.current
      transformRef.current.panX = px0 + dx
      transformRef.current.panY = py0 + dy
      applyTransform()
    }
    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(dragRef.current.raf)
      dragRef.current.raf = requestAnimationFrame(() => onMove(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY))
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      cancelAnimationFrame(dragRef.current.raf)
      dragRef.current.raf = requestAnimationFrame(() => onMove(e.touches[0].clientX - dragRef.current.startX, e.touches[0].clientY - dragRef.current.startY))
    }
    const onUp = () => setIsDragging(false)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [isDragging, applyTransform])

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!fullscreenSvg) return
      if (e.key === 'Escape') closeFullscreen()
      else if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); zoomIn() }
      else if (e.key === '-' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); zoomOut() }
      else if (e.key === '0' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); resetView() }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [fullscreenSvg, closeFullscreen, zoomIn, zoomOut, resetView])

  return {
    fullscreenSvg, zoomPercent, isDragging,
    canvasRef, contentRef,
    openFullscreen, closeFullscreen,
    zoomIn, zoomOut, resetView,
    onWheel, onDragStart, onTouchStart,
  }
}
