/**
 * HighlightPanel — right-side drawer showing all highlights + notes.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CircularProgress from '@mui/material/CircularProgress'
import Drawer from '@mui/material/Drawer'
import Divider from '@mui/material/Divider'
import type { HighlightItem, HighlightColor } from '../../data/highlight/types'
import { COLOR_BG } from './useHighlight'

interface Props {
  open: boolean
  highlights: HighlightItem[]
  loading: boolean
  editingId: number | null
  editingText: string
  onClose: () => void
  onDelete: (id: number) => void
  onStartEdit: (id: number) => void
  onSaveNote: () => void
  onCancelNote: () => void
  onEditingTextChange: (v: string) => void
  onCopyAll: () => void
  onClearAll: () => void
}

const DRAWER_WIDTH = 340

const HighlightPanel = ({
  open, highlights, loading, editingId, editingText,
  onClose, onDelete, onStartEdit, onSaveNote, onCancelNote, onEditingTextChange,
  onCopyAll, onClearAll,
}: Props) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, p: 0 } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          高亮笔记 ({highlights.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {highlights.length > 0 && (
            <>
              <Tooltip title="一键复制全部"><IconButton size="small" onClick={onCopyAll}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="清空全部"><IconButton size="small" color="error" onClick={onClearAll}><DeleteSweepIcon fontSize="small" /></IconButton></Tooltip>
            </>
          )}
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        )}
        {!loading && highlights.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 6, px: 2, color: 'text.disabled', textAlign: 'center' }}>
            <EditIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            <Typography variant="body2">开启笔刷模式后，选中文本即可高亮</Typography>
          </Box>
        )}
        {highlights.slice().reverse().map(h => (
          <Box key={h.id}
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', position: 'relative',
              '&:hover .hl-delete-btn': { display: 'flex' } }}
          >
            {/* Color bar */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ width: 4, flexShrink: 0, borderRadius: 1, bgcolor: COLOR_BG[h.color as HighlightColor] || COLOR_BG.yellow }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Highlight text */}
                <Typography variant="body2" sx={{ lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {h.text}
                </Typography>

                {/* Note */}
                {editingId === h.id ? (
                  <Box sx={{ mt: 1 }}>
                    <TextField multiline rows={2} fullWidth size="small" value={editingText}
                      onChange={e => onEditingTextChange(e.target.value)} placeholder="输入备注…"
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSaveNote() }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button size="small" variant="contained" onClick={onSaveNote}>保存</Button>
                      <Button size="small" onClick={onCancelNote}>取消</Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    {h.note && (
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', p: 0.5, bgcolor: 'grey.50', borderRadius: 1, borderLeft: 2, borderColor: 'primary.main', color: 'text.secondary' }}>
                        {h.note}
                      </Typography>
                    )}
                    <Button size="small" sx={{ mt: 0.5, minWidth: 0, fontSize: '0.7rem' }}
                      onClick={() => onStartEdit(h.id)}>
                      {h.note ? '编辑备注' : '添加备注'}
                    </Button>
                  </>
                )}
              </Box>
            </Box>

            {/* Delete button — hover only */}
            <IconButton size="small"
              className="hl-delete-btn"
              onClick={() => onDelete(h.id)}
              sx={{ position: 'absolute', top: 4, right: 4, display: 'none' }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Drawer>
  )
}

export default HighlightPanel
