/**
 * HighlightToolbar — brush toggle + color picker + panel entry.
 * Integrate into ReaderToolbar or PageToolbar.
 */
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Badge from '@mui/material/Badge'
import FormatPaintIcon from '@mui/icons-material/FormatPaint'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import type { HighlightColor } from '../../data/highlight/types'
import { HIGHLIGHT_COLORS, COLOR_BG } from './useHighlight'

interface Props {
  brushMode: boolean
  activeColor: HighlightColor
  panelOpen: boolean
  highlightCount: number
  onToggleBrush: () => void
  onSelectColor: (c: HighlightColor) => void
  onTogglePanel: () => void
}

const HighlightToolbar = ({ brushMode, activeColor, panelOpen, highlightCount, onToggleBrush, onSelectColor, onTogglePanel }: Props) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {/* Brush toggle */}
      <Tooltip title={brushMode ? '关闭笔刷' : '开启笔刷'}>
        <IconButton size="small" onClick={onToggleBrush}
          sx={{ color: brushMode ? 'primary.main' : 'text.secondary', bgcolor: brushMode ? 'primary.light' : 'transparent' }}>
          <FormatPaintIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Color picker — visible only in brush mode */}
      {brushMode && (
        <Box sx={{ display: 'flex', gap: 0.5, mx: 0.5 }}>
          {HIGHLIGHT_COLORS.map(c => (
            <Box key={c} onClick={() => onSelectColor(c)}
              sx={{
                width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                bgcolor: COLOR_BG[c],
                border: activeColor === c ? '2px solid' : '2px solid transparent',
                borderColor: activeColor === c ? 'text.primary' : 'transparent',
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.15)' },
              }}
            />
          ))}
        </Box>
      )}

      {/* Panel toggle */}
      <Tooltip title="高亮笔记面板">
        <IconButton size="small" onClick={onTogglePanel}
          sx={{ color: panelOpen ? 'primary.main' : 'text.secondary' }}>
          <Badge badgeContent={highlightCount || 0} color="primary" invisible={highlightCount === 0}
            sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
            <ChatBubbleOutlineIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default HighlightToolbar
