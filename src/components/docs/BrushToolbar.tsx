/**
 * BrushToolbar — floating at bottom-center when brush mode is active.
 * Shows color picker + close button. Disappears when brush is off.
 */
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Fade from '@mui/material/Fade'
import CloseIcon from '@mui/icons-material/Close'
import type { HighlightColor } from '../../data/highlight/types'
import { HIGHLIGHT_COLORS, COLOR_BG } from './useHighlight'

interface Props {
  open: boolean
  activeColor: HighlightColor
  onSelectColor: (c: HighlightColor) => void
  onClose: () => void
}

const BrushToolbar = ({ open, activeColor, onSelectColor, onClose }: Props) => {
  return (
    <Fade in={open}>
      <Paper elevation={6}
        sx={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1300, borderRadius: 3, px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 1,
        }}
      >
        {HIGHLIGHT_COLORS.map(c => (
          <Tooltip key={c} title={c} placement="top">
            <Box onClick={() => onSelectColor(c)}
              sx={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                bgcolor: COLOR_BG[c],
                border: activeColor === c ? '3px solid #333' : '3px solid transparent',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.2)' },
              }}
            />
          </Tooltip>
        ))}
        <Tooltip title="关闭笔刷" placement="top">
          <IconButton size="small" onClick={onClose} sx={{ ml: 1 }}><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Paper>
    </Fade>
  )
}

export default BrushToolbar
