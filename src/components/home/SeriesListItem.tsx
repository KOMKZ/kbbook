import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useTheme } from '@mui/material/styles'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { Series } from '../../types/series'

interface Props {
  series: Series
  consumeDragEnded: () => boolean
  editMode?: boolean
}

const SeriesListItem = ({ series, consumeDragEnded, editMode }: Props) => {
  const muiTheme = useTheme()
  const navigate = useNavigate()
  const s = series
  const enabled = s.enabled

  const sortable = useSortable({ id: s.id, disabled: !enabled || !editMode })
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = sortable

  const handleClick = () => {
    if (consumeDragEnded()) return
    navigate(`/docs/${s.id}`)
  }

  const style = editMode
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : enabled ? 1 : 0.7,
      }
    : undefined

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...(editMode ? { ...attributes, ...listeners } : {})}
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: enabled ? 'pointer' : 'not-allowed',
        opacity: enabled ? 1 : 0.7,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: editMode ? 'none' : 'manipulation',
        transition: 'background 0.15s',
        '&:hover': enabled ? { bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(96,165,250,0.05)' : 'rgba(80,70,229,0.03)' } : {},
        '&:last-child': { borderBottom: 0 },
      }}
    >
      {/* Drag handle — only visible in edit mode */}
      {editMode && (
        <Box sx={{ p: 0.5, mx: -0.5, display: 'flex', alignItems: 'center', touchAction: 'none' }}>
          <Box ref={setActivatorNodeRef} {...attributes} {...listeners} sx={{ display: 'flex', cursor: editMode ? 'grab' : 'default', p: 0.5, borderRadius: 1 }}><DragIndicatorIcon sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }} /></Box>
        </Box>
      )}

      {/* Icon */}
      <Box
        sx={{
          width: 32, height: 32, borderRadius: 1,
          bgcolor: enabled ? `${s.color || muiTheme.palette.primary.main}1a` : 'action.disabledBackground',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', flexShrink: 0,
        }}
      >
        {s.icon || '📚'}
      </Box>

      {/* Title + tagline */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} fontSize="0.9rem" noWrap>
          {s.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontSize="0.72rem" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
          {s.tagline || s.description}
        </Typography>
      </Box>

      {/* Status chip */}
      {!enabled && <Chip label="敬请期待" size="small" sx={{ fontSize: '0.65rem', height: 22 }} />}

      {/* Arrow */}
      {enabled && <ArrowForwardIcon sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />}
    </Box>
  )
}

export default SeriesListItem
