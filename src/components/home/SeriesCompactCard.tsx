import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Series } from '../../types/series'

interface Props {
  series: Series
  consumeDragEnded: () => boolean
  editMode?: boolean
}

/**
 * Super-compact series card — icon + title only.
 * Designed for dense 6+ column grids.
 */
const SeriesCompactCard = ({ series, consumeDragEnded, editMode }: Props) => {
  const navigate = useNavigate()
  const s = series
  const enabled = s.enabled

  const sortable = useSortable({ id: s.id, disabled: !enabled || !editMode })
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = sortable

  const handleClick = () => {
    if (consumeDragEnded()) return
    if (!enabled) return
    navigate(`/docs/${s.id}`)
  }

  const style = editMode
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : enabled ? 1 : 0.7,
        zIndex: isDragging ? 1 : 0,
      }
    : undefined

  const content = (
    <Paper
      elevation={0}
      sx={{
        py: { xs: 1, sm: 1.25 },
        px: { xs: 0.5, sm: 0.75 },
        border: 1,
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        textDecoration: 'none',
        color: 'text.primary',
        opacity: enabled ? 1 : 0.55,
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: isDragging
          ? '0 4px 12px rgba(80,70,229,0.18)'
          : 'none',
        pointerEvents: 'none',
        '&:hover': enabled && !isDragging
          ? {
              borderColor: 'primary.main',
              boxShadow: '0 2px 8px rgba(80,70,229,0.08)',
            }
          : {},
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {s.icon || '📚'}
      </Box>
      <Typography
        variant="caption"
        noWrap
        sx={{
          fontWeight: 600,
          fontSize: { xs: '0.65rem', sm: '0.7rem' },
          lineHeight: 1.2,
          maxWidth: '100%',
          textAlign: 'center',
        }}
      >
        {s.shortTitle || s.title}
      </Typography>
    </Paper>
  )

  return (
    <Box
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      sx={{
        cursor: enabled ? (editMode ? 'default' : 'pointer') : 'default',
        position: 'relative',
      }}
    >
      {/* Drag handle — only visible in edit mode */}
      {editMode && enabled && (
        <Box
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 2,
            cursor: isDragging ? 'grabbing' : 'grab',
            p: 0.25,
            borderRadius: 0.5,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        </Box>
      )}
      {content}
    </Box>
  )
}

export default SeriesCompactCard
