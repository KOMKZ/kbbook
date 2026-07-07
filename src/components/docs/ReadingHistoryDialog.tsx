import { useNavigate } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import HistoryIcon from '@mui/icons-material/History'
import type { HistoryEntry } from '../../hooks/useReadingHistory'

interface Props {
  open: boolean
  onClose: () => void
  items: HistoryEntry[]
  onRemove: (slug: string) => void
  onClearAll: () => void
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

const ReadingHistoryDialog = ({ open, onClose, items, onRemove, onClearAll }: Props) => {
  const navigate = useNavigate()

  const handleClick = (entry: HistoryEntry) => {
    navigate(`/docs/${entry.seriesId}/${entry.slug}`)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="small" />
        阅读历史
        <Box sx={{ flex: 1 }} />
        {items.length > 0 && (
          <Button size="small" startIcon={<DeleteSweepIcon />} onClick={onClearAll} color="error">
            清空
          </Button>
        )}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {items.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">暂无阅读记录</Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {items.map((entry) => (
              <ListItemButton key={`${entry.slug}-${entry.timestamp}`} onClick={() => handleClick(entry)} sx={{ pr: 6 }}>
                <ListItemText
                  primary={entry.title}
                  secondary={formatRelative(entry.timestamp)}
                  primaryTypographyProps={{ fontSize: '0.9rem', noWrap: true }}
                  secondaryTypographyProps={{ fontSize: '0.72rem' }}
                />
                <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(entry.slug) }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ReadingHistoryDialog
