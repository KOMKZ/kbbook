import { useCallback } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { FONT_SCALE_MIN, FONT_SCALE_MAX } from './ArticleToolPanel'

interface ReaderToolbarProps {
  fontScale: number
  onFontScaleChange: (scale: number) => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  stickyTitleHidden: boolean
  onToggleStickyTitle: () => void
}

const ReaderToolbar = ({
  fontScale, onFontScaleChange, fullscreen, onToggleFullscreen,
  stickyTitleHidden, onToggleStickyTitle,
}: ReaderToolbarProps) => {
  const zoomIn = useCallback(() => {
    onFontScaleChange(Math.min(FONT_SCALE_MAX, fontScale + 0.1))
  }, [fontScale, onFontScaleChange])
  const zoomOut = useCallback(() => {
    onFontScaleChange(Math.max(FONT_SCALE_MIN, fontScale - 0.1))
  }, [fontScale, onFontScaleChange])

  return (
    <Box sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1250, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Tooltip title="放大字体" placement="left">
        <IconButton size="small" onClick={zoomIn} disabled={fontScale >= FONT_SCALE_MAX}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="缩小字体" placement="left">
        <IconButton size="small" onClick={zoomOut} disabled={fontScale <= FONT_SCALE_MIN}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={stickyTitleHidden ? '显示标题' : '隐藏标题'} placement="left">
        <IconButton size="small" onClick={onToggleStickyTitle}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={fullscreen ? '退出全屏' : '全屏'} placement="left">
        <IconButton size="small" onClick={onToggleFullscreen}>
          {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default ReaderToolbar
