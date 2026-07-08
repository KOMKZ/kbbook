/**
 * HighlightToolbar — brush toggle + panel entry only (no inline color picker).
 * Color selection is handled by BrushToolbar (floating bottom bar).
 */
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Badge from '@mui/material/Badge'
import FormatPaintIcon from '@mui/icons-material/FormatPaint'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'

interface Props {
  brushMode: boolean
  panelOpen: boolean
  highlightCount: number
  onToggleBrush: () => void
  onTogglePanel: () => void
}

const HighlightToolbar = ({ brushMode, panelOpen, highlightCount, onToggleBrush, onTogglePanel }: Props) => {
  return (
    <>
      <Tooltip title={brushMode ? '关闭笔刷' : '笔刷模式'} placement="left">
        <IconButton size="small" onClick={onToggleBrush}
          sx={{ color: brushMode ? 'primary.main' : 'text.secondary', bgcolor: brushMode ? 'primary.light' : 'transparent' }}>
          <FormatPaintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
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
