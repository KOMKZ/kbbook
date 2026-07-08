import { useEffect, useState, useRef } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import ArticleIcon from '@mui/icons-material/Article'
import FolderIcon from '@mui/icons-material/Folder'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import PageToolbar from '../../components/docs/PageToolbar'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import { getSeries, loadSeriesRegistry, loadSeriesMeta, type DocsMetaConfig, type DocMeta } from '../../utils/docs'
import type { Series } from '../../types/series'
import { useReadingHistory } from '../../hooks/useReadingHistory'

/**
 * 系列目录页 — 读取 _meta.json 生成分类目录树
 */

const SeriesDetailPage = () => {
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'
  const navigate = useNavigate()
  const { series: seriesIdParam } = useParams<{ series?: string }>()
  const [series, setSeries] = useState<Series | undefined>()
  const [meta, setMeta] = useState<DocsMetaConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandAll, setExpandAll] = useState(false)

  const isLegacyVersion = !!(seriesIdParam && seriesIdParam.startsWith('v'))

  useEffect(() => {
    if (isLegacyVersion) return
    let cancelled = false
    ;(async () => {
      try {
        const reg = await loadSeriesRegistry()
        const id = seriesIdParam || reg.defaultSeries
        const s = await getSeries(id)
        if (cancelled) return
        setSeries(s)
        if (s && s.enabled && s.version) {
          try {
            const m = await loadSeriesMeta(s.id)
            if (!cancelled) { setMeta(m); setLoading(false) }
          } catch (e) {
            if (!cancelled) { setError(String(e)); setLoading(false) }
          }
        } else {
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [seriesIdParam, isLegacyVersion])

  // Auto-open group containing last-read article + auto-scroll
  const { items: historyItems } = useReadingHistory()
  const autoScrolled = useRef(false)
  const [autoOpenGroup, setAutoOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    if (!meta || historyItems.length === 0 || autoScrolled.current) return
    for (const entry of historyItems) {
      if (entry.seriesId !== seriesIdParam) continue
      // Find which group contains this article
      const findGroup = (items: DocMeta[]): string | null => {
        for (const item of items) {
          if (item.isGroup && item.items) {
            for (const child of item.items) {
              if (child.slug === entry.slug) return item.slug
              if (child.isGroup && child.items) {
                const nested = findGroup([child])
                if (nested) return nested
              }
            }
          }
        }
        return null
      }
      const groupSlug = findGroup(meta.items)
      if (groupSlug) setAutoOpenGroup(groupSlug)
      const el = document.querySelector(`[data-slug="${entry.slug}"]`)
      if (el) { autoScrolled.current = true; setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500); return }
    }
  }, [meta, historyItems, seriesIdParam])
  useEffect(() => { autoScrolled.current = false; setAutoOpenGroup(null) }, [seriesIdParam])

  const handleArticleClick = (slug: string) => {
    if (seriesIdParam) navigate(`/docs/${seriesIdParam}/${slug}`)
  }

  // Legacy redirect
  if (isLegacyVersion) {
    const newId = seriesIdParam!.replace(/^v/, 'llm')
    return <Navigate to={`/docs/${newId}`} replace />
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Box component="main" sx={{ flex: 1, pt: 'var(--header-height)' }}>
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          {/* Series header */}
          {series && (
            <Box sx={{ mb: 4 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                <Box sx={{ fontSize: '1.8rem' }}>{series.icon || '📚'}</Box>
                <Typography variant="h4" fontWeight={700} fontSize={{ xs: '1.3rem', md: '1.6rem' }}>
                  {series.title}
                </Typography>
              </Stack>
              {series.tagline && (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.95rem' }}>
                  {series.tagline}
                </Typography>
              )}
            </Box>
          )}

          {/* Loading / Error */}
          {loading && <Typography color="text.secondary">加载中...</Typography>}
          {error && <Typography color="error">{error}</Typography>}

          {/* Category tree from _meta.json */}
          {meta && (
            <Box>
              {meta.items.map((item) => (
                <MetaItem key={item.slug} item={item} seriesId={seriesIdParam || ''} onArticleClick={handleArticleClick} isDark={isDark} depth={0} defaultOpen={expandAll} autoOpenGroup={autoOpenGroup} />
              ))}
            </Box>
          )}

          {/* Empty state */}
          {!loading && !error && !meta && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <ArticleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">该系列暂无内容</Typography>
            </Box>
          )}
        </Container>
      </Box>
      <Footer />
      <PageToolbar
        extraButtons={
          <>
            <Tooltip title={expandAll ? '全部折叠' : '全部展开'} placement="left">
              <IconButton size="small" onClick={() => setExpandAll((v) => !v)}>
                {expandAll ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </>
        }
      />
    </Box>
  )
}

/** Recursive metadata item — group (collapsible) or article */
const MetaItem = ({ item, seriesId, onArticleClick, isDark, depth, defaultOpen, autoOpenGroup }: {
  item: DocMeta; seriesId: string; onArticleClick: (slug: string) => void; isDark: boolean; depth: number; defaultOpen: boolean; autoOpenGroup?: string | null
}) => {
  const initialOpen = defaultOpen || autoOpenGroup === item.slug
  const [open, setOpen] = useState(initialOpen)
  // Sync with external expandAll toggle
  useEffect(() => { setOpen(defaultOpen || autoOpenGroup === item.slug) }, [defaultOpen, autoOpenGroup, item.slug])

  if (item.isGroup) {
    const children = item.items || []
    return (
      <Box sx={{ mb: 0.5 }}>
        {/* Group header */}
        <Box
          onClick={() => setOpen(!open)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, py: 1.25, px: 1.5, borderRadius: 2,
            cursor: 'pointer', userSelect: 'none',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          }}
        >
          {open ? <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} /> : <ChevronRightIcon sx={{ fontSize: 20, color: 'text.secondary' }} />}
          <FolderIcon sx={{ fontSize: 18, color: 'primary.main', opacity: 0.7 }} />
          <Typography fontWeight={600} fontSize="0.95rem" sx={{ flex: 1 }}>{item.title}</Typography>
          <Chip label={`${children.length} 篇`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
        </Box>
        <Collapse in={open}>
          <Box sx={{ ml: 2, borderLeft: 1, borderColor: 'divider', pl: 1 }}>
            {children.map((child) => (
              <MetaItem key={child.slug} item={child} seriesId={seriesId} onArticleClick={onArticleClick} isDark={isDark} depth={depth + 1} defaultOpen={defaultOpen} autoOpenGroup={autoOpenGroup} />
            ))}
          </Box>
        </Collapse>
      </Box>
    )
  }

  // Article item
  return (
    <Box
      data-slug={item.slug}
      onClick={() => onArticleClick(item.slug)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5, borderRadius: 1.5,
        cursor: 'pointer', transition: 'background 0.15s',
        '&:hover': { bgcolor: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(80,70,229,0.05)' },
      }}
    >
      <ArticleIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
      <Typography variant="body2" fontSize="0.9rem" noWrap sx={{ flex: 1 }}>{item.title}</Typography>
    </Box>
  )
}

export default SeriesDetailPage
