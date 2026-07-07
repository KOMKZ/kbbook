import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useTheme } from '@mui/material/styles'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Series } from '../../types/series'

interface SeriesCardProps {
  series: Series
  consumeDragEnded: () => boolean
  editMode?: boolean
}

const SeriesCard = ({ series, consumeDragEnded, editMode }: SeriesCardProps) => {
  const muiTheme = useTheme()
  const navigate = useNavigate()
  const s = series
  const enabled = s.enabled

  const sortable = useSortable({ id: s.id, disabled: !enabled || !editMode })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const handleClick = () => {
    if (consumeDragEnded()) return
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
        p: { xs: 1.5, sm: 2.5 },
        border: 1,
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: { xs: 1.5, sm: 2 },
        textDecoration: 'none',
        color: 'text.primary',
        opacity: enabled ? 1 : 0.7,
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: isDragging
          ? '0 8px 24px rgba(80,70,229,0.18)'
          : 'none',
        pointerEvents: 'none',
        '&:hover': enabled && !isDragging
          ? {
              borderColor: 'primary.main',
              boxShadow: '0 4px 12px rgba(80,70,229,0.08)',
            }
          : {},
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        <Box
          sx={{
            width: { xs: 28, sm: 36 },
            height: { xs: 28, sm: 36 },
            borderRadius: 1.5,
            bgcolor: enabled ? `${s.color || muiTheme.palette.primary.main}1a` : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: { xs: '1.1rem', sm: '1.3rem' },
            flexShrink: 0,
          }}
        >
          {s.icon || '📚'}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
          {s.title}
        </Typography>
        {!enabled && (
          <Chip
            label="敬请期待"
            size="small"
            sx={{ ml: 'auto', fontSize: '0.68rem', height: 22, bgcolor: '#f1f5f9', color: '#475569' }}
          />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 0.75, sm: 1 }, fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.4, display: { xs: 'none', sm: 'block' } }}>
        {s.tagline || s.description}
      </Typography>
      {enabled && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ display: { xs: 'none', sm: 'flex' } }}>
          <Typography variant="caption" color="text.secondary">
            进入系列
          </Typography>
          <ArrowForwardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        </Stack>
      )}
    </Paper>
  )

  if (!enabled) {
    return (
      <div ref={setNodeRef} style={style}>
        {content}
      </div>
    )
  }

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...(editMode ? { ...attributes, ...listeners } : {})}
      onClick={handleClick}
      sx={{
        cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: editMode ? 'none' : 'manipulation',
        '&:hover': enabled && !isDragging
          ? {}
          : {},
      }}
    >
      {content}
    </Box>
  )
}

export default SeriesCard
