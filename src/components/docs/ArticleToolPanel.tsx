import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import TuneIcon from '@mui/icons-material/Tune'
import TextDecreaseIcon from '@mui/icons-material/TextDecrease'
import TextIncreaseIcon from '@mui/icons-material/TextIncrease'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CircularProgress from '@mui/material/CircularProgress'

export const FONT_SCALE_MIN = 0.8
export const FONT_SCALE_MAX = 3.0
const FONT_STEP = 0.1

const clamp = (v: number) => Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(v * 10) / 10))

interface Props {
  fontScale: number
  onFontScaleChange: (scale: number) => void
  readProgress: number
}

/** Article-specific tool panel: font scale, reading progress */
const ArticleToolPanel = ({ fontScale, onFontScaleChange, readProgress }: Props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const pct = Math.round(fontScale * 100)

  return (
    <>
      <Tooltip title="阅读工具" placement="left">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} color={anchor ? 'primary' : 'default'}>
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
      >
        <Paper sx={{ p: 2, minWidth: 200 }}>
          {/* Font scale */}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>字号 ({pct}%)</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Tooltip title="缩小"><span><IconButton size="small" onClick={() => onFontScaleChange(clamp(fontScale - FONT_STEP))} disabled={fontScale <= FONT_SCALE_MIN}><TextDecreaseIcon fontSize="small" /></IconButton></span></Tooltip>
            <Typography variant="body2" sx={{ minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{pct}%</Typography>
            <Tooltip title="放大"><span><IconButton size="small" onClick={() => onFontScaleChange(clamp(fontScale + FONT_STEP))} disabled={fontScale >= FONT_SCALE_MAX}><TextIncreaseIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="恢复"><span><IconButton size="small" onClick={() => onFontScaleChange(1)} disabled={fontScale === 1}><RestartAltIcon fontSize="small" /></IconButton></span></Tooltip>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Reading progress */}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>阅读进度</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1, position: 'relative', width: 48, height: 48, mx: 'auto' }}>
            <CircularProgress variant="determinate" value={100} size={40} thickness={4} sx={{ color: 'action.hover', position: 'absolute' }} />
            <CircularProgress variant="determinate" value={readProgress} size={40} thickness={4} sx={{ color: 'primary.main' }} />
            <Typography variant="caption" sx={{ position: 'absolute', fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary' }}>
              {readProgress}
            </Typography>
          </Box>
        </Paper>
      </Popover>
    </>
  )
}

export default ArticleToolPanel
