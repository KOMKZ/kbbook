import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import { useTheme } from '@mui/material/styles'
import { Fade } from '@mui/material'

interface SearchResult {
  code: string
  title: string
  slug: string
  seriesId: string
  seriesTitle: string
  excerpt: string
}

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

const SearchDialog = ({ open, onClose }: SearchDialogProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  // 加载搜索索引
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/search-index.json')
      .then((r) => r.json())
      .then((data: SearchResult[]) => {
        setIndex(data)
        setLoading(false)
      })
      .catch(() => {
        setIndex([])
        setLoading(false)
      })
  }, [open])

  // 自动 focus 输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setSelectedIdx(0)
    }
  }, [open])

  // 搜索逻辑:标题精确匹配 > 标题模糊匹配 > 内容匹配
  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const titleMatches: SearchResult[] = []
    const contentMatches: SearchResult[] = []

    for (const doc of index) {
      const titleLow = doc.title.toLowerCase()
      if (titleLow.includes(q)) {
        titleMatches.push(doc)
      } else if (doc.excerpt.toLowerCase().includes(q)) {
        contentMatches.push(doc)
      }
    }

    return [...titleMatches, ...contentMatches].slice(0, 15)
  }, [query, index])

  // 重置选中索引当结果变化
  useEffect(() => {
    setSelectedIdx(0)
  }, [results.length])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(`/docs/${result.seriesId}/${result.slug}`)
      onClose()
    },
    [navigate, onClose],
  )

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIdx]) {
        e.preventDefault()
        handleSelect(results[selectedIdx])
      }
    },
    [results, selectedIdx, handleSelect],
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Fade}
      transitionDuration={200}
      slotProps={{
        backdrop: {
          timeout: 200,
        },
      }}
      sx={{
        '& .MuiDialog-container': { alignItems: 'flex-start', pt: '12vh' },
        '& .MuiDialog-paper': {
          borderRadius: 2.5,
          boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.6)'
            : '0 20px 60px rgba(0,0,0,0.15)',
        },
      }}
    >
      <DialogContent sx={{ p: 0, '&:first-of-type': { pt: 0 } }}>
        {/* 搜索输入栏 */}
        <Box sx={{ px: 2, pt: 2, pb: results.length > 0 ? 1 : 2 }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            variant="outlined"
            placeholder="搜索文章…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1rem',
                '& fieldset': { borderColor: 'divider' },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQuery('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
        </Box>

        {/* 结果列表 */}
        {results.length > 0 && (
          <List dense sx={{ py: 0, maxHeight: 360, overflow: 'auto' }}>
            {results.map((result, idx) => {
              const selected = idx === selectedIdx
              return (
                <ListItemButton
                  key={result.slug}
                  selected={selected}
                  onClick={() => handleSelect(result)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&.Mui-selected': {
                      bgcolor: isDark ? 'rgba(96,165,250,0.12)' : 'rgba(80,70,229,0.08)',
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {result.title}
                        </Typography>
                        <Chip
                          label={result.seriesTitle}
                          size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 500, flexShrink: 0 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.75rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {result.excerpt}
                      </Typography>
                    }
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <Box sx={{ px: 2, pb: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              未找到与 「{query}」 相关的文章
            </Typography>
          </Box>
        )}

        {!query.trim() && !loading && (
          <Box sx={{ px: 2, pb: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              输入关键词搜索所有系列文章
            </Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="caption" color="text.disabled">
              加载中…
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SearchDialog
