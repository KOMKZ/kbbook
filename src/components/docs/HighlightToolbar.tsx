/**
 * HighlightToolbar — brush toggle + popover color picker + panel entry.
 * Each button renders as a standalone IconButton for proper column layout.
 */
import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
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
  const brushRef = useRef<HTMLButtonElement>(null)
  const [colorOpen, setColorOpen] = useState(false)

  return (
    <>
      {/* Brush toggle */}
      <Tooltip title={brushMode ? '关闭笔刷' : '笔刷模式'} placement="left">
        <IconButton size="small" ref={brushRef}
          onClick={() => { onToggleBrush(); if (!brushMode) setColorOpen(true) }}
          sx={{ color: brushMode ? 'primary.main' : 'text.secondary', bgcolor: brushMode ? 'primary.light' : 'transparent' }}>
          <FormatPaintIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Color popover — opens when brush enters active mode */}
      <Popover open={brushMode && colorOpen} anchorEl={brushRef.current}
        onClose={() => setColorOpen(false)}
        anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
        transformOrigin={{ vertical: 'center', horizontal: 'right' }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, p: 1 }}>
          {HIGHLIGHT_COLORS.map(c => (
            <Box key={c} onClick={() => { onSelectColor(c); setColorOpen(false) }}
              sx={{
                width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                bgcolor: COLOR_BG[c],
                border: activeColor === c ? '2px solid' : '2px solid transparent',
                borderColor: activeColor === c ? 'text.primary' : 'transparent',
                '&:hover': { transform: 'scale(1.15)' },
              }}
            />
          ))}
        </Box>
      </Popover>

      {/* Panel toggle */}
      <Tooltip title="笔记面板" placement="left">
        <IconButton size="small" onClick={onTogglePanel}
          sx={{ color: panelOpen ? 'primary.main' : 'text.secondary' }}>
          <Badge badgeContent={highlightCount || 0} color="primary" invisible={highlightCount === 0}
            sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
            <ChatBubbleOutlineIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
    </>
  )
}

export default HighlightToolbar
