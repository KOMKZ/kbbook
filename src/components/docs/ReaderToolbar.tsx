import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Fade from '@mui/material/Fade'
import TuneIcon from '@mui/icons-material/Tune'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import TextDecreaseIcon from '@mui/icons-material/TextDecrease'
import TextIncreaseIcon from '@mui/icons-material/TextIncrease'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import HomeIcon from '@mui/icons-material/Home'
import DashboardIcon from '@mui/icons-material/Dashboard'
import StopIcon from '@mui/icons-material/Stop'
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Snackbar from '@mui/material/Snackbar'
import type { SpeechState } from '../../hooks/useSpeech'
import ReadingHistoryDialog from './ReadingHistoryDialog'
import { useReadingHistory } from '../../hooks/useReadingHistory'

export const FONT_SCALE_MIN = 0.8
export const FONT_SCALE_MAX = 1.8
export const FONT_SCALE_STEP = 0.1

interface ReaderToolbarProps {
  fontScale: number
  onFontScaleChange: (scale: number) => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  stickyTitleHidden: boolean
  onToggleStickyTitle: () => void
  articleTitle?: string
  seriesId?: string
  content?: string
  speechState: SpeechState
  speechProgress: { current: number; total: number }
  onSpeechPlay: () => void
  onSpeechStop: () => void
}

const clampScale = (v: number) =>
  Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(v * 10) / 10))

// Load saved toolbar Y position
const loadToolbarY = (): number | null => {
  try {
    const v = localStorage.getItem('lz-toolbar-y')
    if (v) return parseInt(v, 10)
  } catch {}
  return null
}
const saveToolbarY = (y: number) => {
  try { localStorage.setItem('lz-toolbar-y', String(y)) } catch {}
}

const ReaderToolbar = ({
  fontScale, onFontScaleChange, fullscreen, onToggleFullscreen,
  stickyTitleHidden, onToggleStickyTitle, articleTitle, seriesId, content,
  speechState, speechProgress, onSpeechPlay, onSpeechStop,
}: ReaderToolbarProps) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Draggable Y position
  const [toolbarY, setToolbarY] = useState<number | null>(loadToolbarY)
  const dragging = useRef(false)
  const dragStart = useRef({ y: 0, toolbarY: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Reading history
  const { items: historyItems, addEntry: addHistory, removeEntry: removeHistory, clearAll: clearHistory } = useReadingHistory()

  // Record reading when article loads
  useEffect(() => {
    if (content && articleTitle && seriesId) {
      // Extract slug from URL: /docs/seriesId/slug/... → slug
      const pathname = window.location.pathname
      const prefix = `/docs/${seriesId}/`
      const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
      const slug = rest.replace(/\/$/, '')
      if (slug) {
        console.log('[History] recording:', slug, articleTitle, seriesId)
        addHistory(slug, articleTitle, seriesId)
      }
    }
  }, [content, articleTitle, seriesId])

  // Drag handlers — use refs to avoid re-binding on every move
  const toolbarYRef = useRef(toolbarY)
  toolbarYRef.current = toolbarY

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dragging.current = true
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
    dragStart.current = { y: clientY, toolbarY: toolbarYRef.current ?? window.innerHeight * 0.4 }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
      const dy = clientY - dragStart.current.y
      const newY = Math.max(60, Math.min(window.innerHeight - 200, dragStart.current.toolbarY + dy))
      setToolbarY(newY)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (toolbarYRef.current != null) saveToolbarY(toolbarYRef.current)
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

  // Reading progress
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)
  const [readProgress, setReadProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setAtTop(y < 16)
      setAtBottom(max > 0 ? y > max - 16 : true)
      setReadProgress(max > 0 ? Math.min(100, Math.round((y / max) * 100)) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  const pct = Math.round(fontScale * 100)
  const decrease = () => onFontScaleChange(clampScale(fontScale - FONT_SCALE_STEP))
  const increase = () => onFontScaleChange(clampScale(fontScale + FONT_SCALE_STEP))
  const reset = () => onFontScaleChange(1)

  const copyTitle = async () => {
    const title = articleTitle?.trim()
    if (!title) { setToast('无标题可复制'); return }
    try { await navigator.clipboard.writeText(title); setToast(title) } catch {
      try {
        const ta = document.createElement('textarea'); ta.value = title; ta.style.position = 'fixed'; ta.style.left = '-9999px'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); setToast(title)
      } catch { setToast('复制失败') }
    }
  }

  // Main button group
  const mainButtons = (
    <>
      {/* TTS */}
      <Tooltip title={!content ? '文章加载中...' : speechState === 'speaking' ? '停止朗读' : '朗读文章'} placement="left">
        <span>
          <IconButton onClick={() => { if (!content) return; speechState === 'speaking' ? onSpeechStop() : onSpeechPlay() }}
            size="medium" color={speechState === 'speaking' ? 'primary' : 'default'} disabled={!content}>
            {speechState === 'speaking' ? <StopIcon /> : <RecordVoiceOverIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {/* History */}
      <Tooltip title="阅读历史" placement="left">
        <IconButton size="medium" onClick={() => setHistoryOpen(true)}>
          <HistoryIcon />
        </IconButton>
      </Tooltip>

      {/* Refresh */}
      <Tooltip title="刷新页面" placement="left">
        <IconButton size="medium" onClick={() => window.location.reload()}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Fullscreen */}
      <Tooltip title={fullscreen ? '退出全屏' : '全屏阅读'} placement="left">
        <IconButton onClick={onToggleFullscreen} size="medium" color={fullscreen ? 'primary' : 'default'}>
          {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Tooltip>

      {/* Expand panel toggle */}
      <Tooltip title={open ? '收起工具栏' : '阅读工具'} placement="left">
        <IconButton onClick={() => setOpen((v) => !v)} size="medium" color={open ? 'primary' : 'default'}>
          {open ? <CloseIcon /> : <TuneIcon />}
        </IconButton>
      </Tooltip>

      {/* Copy title */}
      <Tooltip title="复制标题" placement="left">
        <span>
          <IconButton onClick={copyTitle} size="medium" disabled={!articleTitle}><ContentCopyIcon /></IconButton>
        </span>
      </Tooltip>

      <Divider sx={{ my: 0.25 }} />

      {/* Scroll */}
      <Tooltip title="回到顶部" placement="left">
        <span><IconButton onClick={scrollToTop} size="medium" disabled={atTop}><VerticalAlignTopIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="回到底部" placement="left">
        <span><IconButton onClick={scrollToBottom} size="medium" disabled={atBottom}><VerticalAlignBottomIcon /></IconButton></span>
      </Tooltip>

      <Divider sx={{ my: 0.25 }} />

      {/* Nav */}
      <Tooltip title="系列导航" placement="left">
        <span><IconButton onClick={() => seriesId && navigate(`/docs/${seriesId}`)} size="medium" disabled={!seriesId}><DashboardIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title="回到首页" placement="left">
        <IconButton onClick={() => navigate('/')} size="medium"><HomeIcon /></IconButton>
      </Tooltip>

      <Divider sx={{ my: 0.25 }} />

      {/* Progress */}
      <Tooltip title={`阅读进度 ${readProgress}%`} placement="left">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5, position: 'relative' }}>
          <CircularProgress variant="determinate" value={100} size={36} thickness={3.5} sx={{ color: 'action.hover', position: 'absolute' }} />
          <CircularProgress variant="determinate" value={readProgress} size={36} thickness={3.5} sx={{ color: 'primary.main' }} />
          <Typography variant="caption" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
            {readProgress}
          </Typography>
        </Box>
      </Tooltip>
    </>
  )

  return (
    <>
      {/* Collapsed state: single floating button */}
      <Fade in={collapsed}>
        <Paper elevation={4}
          sx={{
            position: 'fixed',
            right: { xs: 8, sm: 16 },
            top: toolbarY != null ? toolbarY : { xs: 'auto', md: '40%' },
            bottom: toolbarY != null ? 'auto' : { xs: 16, md: 'auto' },
            zIndex: 1250,
            borderRadius: 3,
          }}
        >
          <Tooltip title="展开工具栏" placement="left">
            <IconButton onClick={() => setCollapsed(false)}><UnfoldMoreIcon /></IconButton>
          </Tooltip>
        </Paper>
      </Fade>

      {/* Expanded state */}
      <Fade in={!collapsed}>
        <Box
          ref={toolbarRef}
          sx={{
            position: 'fixed',
            right: { xs: 8, sm: 16 },
            top: toolbarY != null ? toolbarY : { xs: 'auto', md: '40%' },
            bottom: toolbarY != null ? 'auto' : { xs: 16, md: 'auto' },
            transform: { xs: 'none', md: 'none' },
            zIndex: 1250,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1.5 },
            flexDirection: { xs: 'column-reverse', md: 'row-reverse' },
          }}
        >
          {/* Drag handle — separate, bigger touch target */}
          <Paper
            elevation={2}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, px: 1.5, py: 1.5, mb: 1,
              cursor: 'grab', '&:active': { cursor: 'grabbing' },
              touchAction: 'none', userSelect: 'none',
              minWidth: 44, minHeight: 44,
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
          </Paper>

          {/* Main buttons */}
          <Paper elevation={3}
            sx={{ display: 'flex', flexDirection: 'column', borderRadius: 6, p: 0.5, gap: 0.5 }}
          >
            {mainButtons}
          </Paper>

          {/* Collapse button */}
          <Tooltip title="折叠工具栏" placement="left">
            <IconButton size="small" onClick={() => setCollapsed(true)}
              sx={{ bgcolor: 'background.paper', boxShadow: 2, '&:hover': { bgcolor: 'action.hover' } }}>
              <UnfoldLessIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Expanded panel */}
          <Fade in={open} unmountOnExit>
            <Paper elevation={4} sx={{ p: 1.5, borderRadius: 3, minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 600 }}>字号(整体缩放)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                <Tooltip title="缩小"><span><IconButton size="small" onClick={decrease} disabled={fontScale <= FONT_SCALE_MIN}><TextDecreaseIcon fontSize="small" /></IconButton></span></Tooltip>
                <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{pct}%</Typography>
                <Tooltip title="放大"><span><IconButton size="small" onClick={increase} disabled={fontScale >= FONT_SCALE_MAX}><TextIncreaseIcon fontSize="small" /></IconButton></span></Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="恢复 100%"><span><IconButton size="small" onClick={reset} disabled={fontScale === 1}><RestartAltIcon fontSize="small" /></IconButton></span></Tooltip>
              </Box>
              <Divider sx={{ my: 1.25 }} />
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 600 }}>顶部标题栏</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{stickyTitleHidden ? '已隐藏' : '显示中'}</Typography>
                <Tooltip title={stickyTitleHidden ? '显示顶部标题栏' : '隐藏顶部标题栏'}>
                  <IconButton size="small" onClick={onToggleStickyTitle} color={stickyTitleHidden ? 'default' : 'primary'}>
                    {stickyTitleHidden ? <PushPinOutlinedIcon fontSize="small" /> : <PushPinIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
              {speechState === 'speaking' && (
                <>
                  <Divider sx={{ my: 1.25 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 600 }}>
                    朗读中 ({speechProgress.current}/{speechProgress.total})
                  </Typography>
                  <LinearProgress variant="determinate"
                    value={speechProgress.total > 0 ? (speechProgress.current / speechProgress.total) * 100 : 0}
                    sx={{ mt: 0.75, mb: 1, height: 4, borderRadius: 2 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <RecordVoiceOverIcon color="primary" fontSize="small" />
                    <Typography variant="body2" color="primary" fontWeight={500} sx={{ flex: 1 }}>朗读中...</Typography>
                    <Tooltip title="停止朗读">
                      <IconButton size="small" onClick={onSpeechStop} color="error"><StopIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                </>
              )}
            </Paper>
          </Fade>
        </Box>
      </Fade>

      {/* History Dialog */}
      <ReadingHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={historyItems}
        onRemove={removeHistory}
        onClearAll={clearHistory}
      />

      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 40 }, '& .MuiSnackbarContent-root': { maxWidth: 520 } }} />
    </>
  )
}

export default ReaderToolbar
