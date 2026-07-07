import { useState, useCallback, useRef, useEffect } from 'react'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 5
const ZOOM_STEP = 0.15

export interface MermaidZoomState {
  fullscreenSvg: string | null
  zoom: number
  panX: number
  panY: number
  isDragging: boolean
}

export function useMermaidZoom() {
  const [fullscreenSvg, setFullscreenSvg] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const dragState = useRef({ startX: 0, startY: 0, panStartX: 0, panStartY: 0 })

  const fitSvgToCanvas = useCallback(() => {
    if (!canvasRef.current) return
    const svg = canvasRef.current.querySelector('svg')
    if (!svg) return

    const viewBox = svg.getAttribute('viewBox')
    if (!viewBox) return
    const parts = viewBox.split(/[\s,]+/)
    if (parts.length < 4) return

    const svgW = parseFloat(parts[2])
    const svgH = parseFloat(parts[3])
    const padding = 48
    const totalW = svgW + padding
    const totalH = svgH + padding

    const rect = canvasRef.current.getBoundingClientRect()
    const margin = 48
    const availW = rect.width - margin * 2
    const availH = rect.height - margin * 2

    const fitZoom = Math.min(availW / totalW, availH / totalH, 1.5)
    setZoom(fitZoom)
    setPanX(-(totalW * fitZoom) / 2)
    setPanY(-(totalH * fitZoom) / 2)
  }, [])

  const openFullscreen = useCallback(
    (svgElement: SVGElement) => {
      const clone = svgElement.cloneNode(true) as SVGElement
      // 保留 style（含 Mermaid background），只清掉可能干扰全屏的定位属性
      const style = clone.getAttribute('style') || ''
      clone.setAttribute('style', style.replace(/position\s*:\s*[^;]+;?/gi, '').replace(/max-width\s*:\s*[^;]+;?/gi, ''))
      const vb = clone.getAttribute('viewBox')
      if (vb) {
        const p = vb.split(/[\s,]+/)
        if (p.length >= 4) {
          clone.setAttribute('width', p[2])
          clone.setAttribute('height', p[3])
        }
      }
      setFullscreenSvg(clone.outerHTML)
      requestAnimationFrame(() => {
        requestAnimationFrame(fitSvgToCanvas)
      })
    },
    [fitSvgToCanvas],
  )

  const closeFullscreen = useCallback(() => {
    setFullscreenSvg(null)
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z * (1 + ZOOM_STEP)))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z * (1 - ZOOM_STEP)))
  }, [])

  const resetView = useCallback(() => {
    fitSvgToCanvas()
  }, [fitSvgToCanvas])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      setZoom((oldZoom) => {
        const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom * factor))
        const ratio = newZoom / oldZoom

        setPanX((px) => cursorX - ratio * (cursorX - px))
        setPanY((py) => cursorY - ratio * (cursorY - py))

        return newZoom
      })
    },
    [],
  )

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        panStartX: panX,
        panStartY: panY,
      }
    },
    [panX, panY],
  )

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return
      setIsDragging(true)
      dragState.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        panStartX: panX,
        panStartY: panY,
      }
    },
    [panX, panY],
  )

  useEffect(() => {
    if (!isDragging) return

    const onMove = (e: MouseEvent) => {
      const { startX, startY, panStartX, panStartY } = dragState.current
      setPanX(panStartX + (e.clientX - startX))
      setPanY(panStartY + (e.clientY - startY))
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const { startX, startY, panStartX, panStartY } = dragState.current
      setPanX(panStartX + (e.touches[0].clientX - startX))
      setPanY(panStartY + (e.touches[0].clientY - startY))
    }

    const onUp = () => setIsDragging(false)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [isDragging])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!fullscreenSvg) return

      if (e.key === 'Escape') {
        closeFullscreen()
      } else if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        resetView()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [fullscreenSvg, closeFullscreen, zoomIn, zoomOut, resetView])

  return {
    fullscreenSvg,
    zoom,
    panX,
    panY,
    isDragging,
    canvasRef,
    openFullscreen,
    closeFullscreen,
    zoomIn,
    zoomOut,
    resetView,
    onWheel,
    onDragStart,
    onTouchStart,
  }
}
