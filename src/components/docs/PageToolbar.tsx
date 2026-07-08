import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Fade from '@mui/material/Fade'
import Divider from '@mui/material/Divider'
import RefreshIcon from '@mui/icons-material/Refresh'
import HomeIcon from '@mui/icons-material/Home'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import HistoryIcon from '@mui/icons-material/History'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ReadingHistoryDialog from './ReadingHistoryDialog'
import { useReadingHistory } from '../../hooks/useReadingHistory'
import { useToolbarSizeCtx } from '../../contexts/ToolbarSizeContext'
// preferences via localStorage


function loadY(): number | null {
  return null
}
function saveY(y: number) { try { localStorage.setItem("kbbook-toolbar-y", String(y)) } catch {} }

interface Props {
  extraButtons?: React.ReactNode
  seriesId?: string
  columns?: number  // 1-4, default 1 (vertical), >1 uses flexWrap
}

const PageToolbar = ({ extraButtons, seriesId, columns = 1 }: Props) => {
  const navigate = useNavigate()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { items, removeEntry, clearAll } = useReadingHistory()
  const cols = Math.max(1, Math.min(4, columns))
  const { toolbarSize: s } = useToolbarSizeCtx()

  // Auto-collapse after inactivity (default 10s, configurable in Settings)
  // Timer resets on any toolbar button click. Scroll does NOT reset.
  const autoHideDelay = 10000
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetAutoHide = useCallback(() => {
    if (autoHideDelay <= 0) return
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    setCollapsed(false)
    autoHideRef.current = setTimeout(() => setCollapsed(true), autoHideDelay)
  }, [autoHideDelay])

  // Start timer on mount, clear on unmount
  useEffect(() => {
    if (autoHideDelay <= 0) return
    autoHideRef.current = setTimeout(() => setCollapsed(true), autoHideDelay)
    return () => { if (autoHideRef.current) clearTimeout(autoHideRef.current) }
  }, [autoHideDelay])

  // Drag
  const [toolbarY, setToolbarY] = useState<number | null>(loadY)
  const dragging = useRef(false)
  const dragStart = useRef({ y: 0, ty: 0 })
  const toolbarYRef = useRef(toolbarY)
  toolbarYRef.current = toolbarY

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dragging.current = true
    const cy = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
    dragStart.current = { y: cy, ty: toolbarYRef.current ?? window.innerHeight - 200 }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const cy = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
      const dy = cy - dragStart.current.y
      setToolbarY(Math.max(60, Math.min(window.innerHeight - 60, dragStart.current.ty + dy)))
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (toolbarYRef.current != null) saveY(toolbarYRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })

  const top = toolbarY ?? 'auto'
  const bottom = toolbarY != null ? 'auto' : { xs: 16, sm: 24 }

  return (
    <>
      {/* Collapsed */}
      <Fade in={collapsed}>
        <Box sx={{ position: 'fixed', right: { xs: 8, sm: 16 }, top, bottom, zIndex: 1250, transform: `scale(${s})`, transformOrigin: 'right bottom' }}>
          <Paper elevation={4} sx={{ borderRadius: 3 }}>
            <Tooltip title="展开工具栏" placement="left">
              <IconButton size="small" onClick={resetAutoHide}><UnfoldMoreIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Paper>
        </Box>
      </Fade>

      {/* Expanded */}
      <Fade in={!collapsed}>
        <Box sx={{ position: 'fixed', right: { xs: 8, sm: 16 }, top, bottom, zIndex: 1250, transform: `scale(${s})`, transformOrigin: 'right bottom' }}>
          <Paper elevation={3}
            sx={{
              display: 'flex', flexDirection: cols > 1 ? 'row' : 'column',
              flexWrap: cols > 1 ? 'wrap' : 'nowrap',
              maxWidth: cols > 1 ? cols * 56 + (cols - 1) * 4 : undefined,
              borderRadius: 3, p: 0.5, gap: 0.25,
            }}
            onMouseEnter={() => { if (autoHideRef.current) clearTimeout(autoHideRef.current) }}
            onMouseLeave={resetAutoHide}
          >
            {/* Drag handle */}
            <Paper elevation={0}
              onMouseDown={onDragStart} onTouchStart={onDragStart}
              sx={{ display: 'flex', justifyContent: 'center', py: 0.25, cursor: 'grab',
                touchAction: 'none', '&:active': { cursor: 'grabbing' }, bgcolor: 'transparent' }}
            >
              <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            </Paper>

            {/* Common buttons */}
            <Tooltip title="刷新" placement="left">
              <IconButton size="small" onClick={() => window.location.reload()}><RefreshIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="阅读历史" placement="left">
              <IconButton size="small" onClick={() => setHistoryOpen(true)}><HistoryIcon fontSize="small" /></IconButton>
            </Tooltip>

            {/* Extra buttons (article-specific) */}
            {extraButtons}

            <Divider sx={{ my: 0.25 }} />

            <Tooltip title="回到顶部" placement="left">
              <IconButton size="small" onClick={scrollToTop}><VerticalAlignTopIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="回到底部" placement="left">
              <IconButton size="small" onClick={scrollToBottom}><VerticalAlignBottomIcon fontSize="small" /></IconButton>
            </Tooltip>

            <Divider sx={{ my: 0.25 }} />

            <Tooltip title="回到首页" placement="left">
              <IconButton size="small" onClick={() => navigate('/')}><HomeIcon fontSize="small" /></IconButton>
            </Tooltip>

            {seriesId && (
              <Tooltip title="回到系列目录" placement="left">
                <IconButton size="small" onClick={() => navigate(`/docs/${seriesId}`)}><CollectionsBookmarkIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}

            {/* Collapse */}
            <Tooltip title="折叠" placement="left">
              <IconButton size="small" onClick={() => { setCollapsed(true); if (autoHideRef.current) clearTimeout(autoHideRef.current) }} sx={{ alignSelf: 'center' }}>
                <UnfoldLessIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Paper>
        </Box>
      </Fade>

      <ReadingHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)}
        items={items} onRemove={removeEntry} onClearAll={clearAll} />
    </>
  )
}

export default PageToolbar
