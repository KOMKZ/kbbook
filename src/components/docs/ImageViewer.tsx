/**
 * ImageViewer — fullscreen image preview with native zoom/pan.
 * Zero React transform overhead. Reusable for any image URL.
 *
 * Features: wheel zoom, drag pan, double-click fit/reset, pinch zoom, Esc close.
 */
import { useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import FitScreenIcon from '@mui/icons-material/FitScreen'

interface Props {
  open: boolean
  src: string
  alt?: string
  label?: string  // shown in toolbar
  onClose: () => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const STEP = 0.2

const ImageViewer = ({ open, src, alt, label, onClose }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const stateRef = useRef({ zoom: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ix: 0, iy: 0, raf: 0 })

  const apply = useCallback(() => {
    if (!imgRef.current) return
    const { zoom, x, y } = stateRef.current
    imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
  }, [])

  const fitToScreen = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return
    const img = imgRef.current
    const rect = containerRef.current.getBoundingClientRect()
    const iw = img.naturalWidth, ih = img.naturalHeight
    const fit = Math.min((rect.width - 80) / iw, (rect.height - 80) / ih, 1)
    stateRef.current = { zoom: fit, x: (rect.width - iw * fit) / 2, y: (rect.height - ih * fit) / 2, dragging: false, sx: 0, sy: 0, ix: 0, iy: 0, raf: 0 }
    apply()
  }, [apply])

  // Init on open
  useEffect(() => { if (open) { stateRef.current.zoom = 1; stateRef.current.x = 0; stateRef.current.y = 0; setTimeout(fitToScreen, 100) } }, [open, fitToScreen, src])

  // Wheel zoom
  useEffect(() => {
    if (!open) return
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const s = stateRef.current
      const factor = e.deltaY < 0 ? 1 + STEP : 1 - STEP
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom * factor))
      const r = nz / s.zoom
      s.x = cx - r * (cx - s.x)
      s.y = cy - r * (cy - s.y)
      s.zoom = nz
      apply()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, apply])

  // Drag
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const s = stateRef.current
      s.dragging = true
      const ce = 'touches' in e ? e.touches[0] : e
      s.sx = ce.clientX; s.sy = ce.clientY
      s.ix = s.x; s.iy = s.y
    }
    const onMove = (e: MouseEvent | TouchEvent) => {
      const s = stateRef.current
      if (!s.dragging) return
      const ce = 'touches' in e ? e.touches[0] : (e as MouseEvent)
      cancelAnimationFrame(s.raf)
      s.raf = requestAnimationFrame(() => {
        s.x = s.ix + (ce.clientX - s.sx)
        s.y = s.iy + (ce.clientY - s.sy)
        apply()
      })
    }
    const onUp = () => { stateRef.current.dragging = false }
    const el = containerRef.current
    if (!el) return
    el.addEventListener('mousedown', onDown)
    el.addEventListener('touchstart', onDown, { passive: false })
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('touchstart', onDown)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [open, apply])

  // Keyboard
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); fitToScreen() }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose, fitToScreen])

  const zoomIn = () => { stateRef.current.zoom = Math.min(MAX_ZOOM, stateRef.current.zoom * 1.3); apply() }
  const zoomOut = () => { stateRef.current.zoom = Math.max(MIN_ZOOM, stateRef.current.zoom / 1.3); apply() }

  if (!open) return null

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 9999, bgcolor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, bgcolor: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
          {label || alt || 'Image Viewer'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Zoom out"><IconButton size="small" onClick={zoomOut} sx={{ color: 'rgba(255,255,255,0.8)' }}><RemoveIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Zoom in"><IconButton size="small" onClick={zoomIn} sx={{ color: 'rgba(255,255,255,0.8)' }}><AddIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Fit to screen"><IconButton size="small" onClick={fitToScreen} sx={{ color: 'rgba(255,255,255,0.8)', ml: 1 }}><FitScreenIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
        <Tooltip title="Close (Esc)"><IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.8)' }}><CloseIcon /></IconButton></Tooltip>
      </Box>

      {/* Image area */}
      <Box ref={containerRef}
        sx={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: stateRef.current.dragging ? 'grabbing' : 'grab' }}
        onDoubleClick={fitToScreen}
      >
        <img ref={imgRef} src={src} alt={alt || ''}
          style={{ position: 'absolute', transformOrigin: '0 0', userSelect: 'none', pointerEvents: 'none' }}
        />
      </Box>

      {/* Hint */}
      <Box sx={{ px: 3, py: 1, bgcolor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', gap: 3 }}>
        {['Scroll: Zoom', 'Drag: Pan', 'Double-click: Fit', 'Esc: Close'].map(h => (
          <Typography key={h} variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{h}</Typography>
        ))}
      </Box>
    </Box>
  )
}

export default ImageViewer
