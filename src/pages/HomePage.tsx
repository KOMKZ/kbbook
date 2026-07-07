import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import GitHubIcon from '@mui/icons-material/GitHub'
import { useTheme } from '@mui/material/styles'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { loadSeriesRegistry } from '../utils/docs'
import { useSeriesOrder } from '../utils/useSeriesOrder'
import { siteConfig } from '../config/site'
import type { Series } from '../types/series'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import QuoteBanner from '../components/home/QuoteBanner'
import SeriesCard from '../components/home/SeriesCard'
import SeriesListItem from '../components/home/SeriesListItem'
import PageToolbar from '../components/docs/PageToolbar'

type LayoutMode = 'list' | 'card'
const LAYOUT_KEY = 'lz-home-layout'

const loadLayoutMode = (): LayoutMode => {
  try {
    const v = localStorage.getItem(LAYOUT_KEY)
    if (v === 'card' || v === 'list') return v
  } catch {}
  return 'list'
}

/**
 * 多系列门户首页
 *
 * 分区:Hero(小) → 系列宫格 → 最近更新 → 关于这个站
 */
const HomePage = () => {
  const muiTheme = useTheme()
  const isDark = muiTheme.palette.mode === 'dark'
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [layout, setLayout] = useState<LayoutMode>(loadLayoutMode)
  const [editMode, setEditMode] = useState(false)

  const setLayoutPersist = (mode: LayoutMode) => {
    setLayout(mode)
    try { localStorage.setItem(LAYOUT_KEY, mode) } catch {}
  }

  const [orderedSeries, reorderSeries] = useSeriesOrder(seriesList)
  const orderedIds = useMemo(() => orderedSeries.map((s) => s.id), [orderedSeries])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const dragJustEndedRef = useRef(false)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = orderedIds.indexOf(active.id as string)
      const newIndex = orderedIds.indexOf(over.id as string)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSeries(oldIndex, newIndex)
      }
    }
    dragJustEndedRef.current = true
  }

  const consumeDragEnded = useCallback(() => {
    if (dragJustEndedRef.current) {
      dragJustEndedRef.current = false
      return true
    }
    return false
  }, [])

  useEffect(() => {
    loadSeriesRegistry()
      .then(async (reg) => {
        setSeriesList(reg.series)
      })
      .catch(() => {})
  }, [])

  return (
    <Box sx={{ minHeight: 'calc(100vh - var(--header-height))', pt: 'var(--header-height)' }}>
      {/* 顶部:励志名言滚动 banner */}
      <QuoteBanner />
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: 4 }}>
        {/* Hero */}
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              mb: { xs: 0.75, md: 1 },
              fontSize: { xs: '1.35rem', sm: '1.8rem', md: '2rem' },
              lineHeight: 1.3,
              letterSpacing: 0.5,
              fontFamily: '"Source Han Serif","Noto Serif SC","Songti SC",serif',
              background: muiTheme.palette.mode === 'dark'
                ? 'linear-gradient(120deg, #e2e8f0 0%, #c7d2fe 100%)'
                : 'linear-gradient(120deg, #1e293b 0%, #5046e5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {siteConfig.tagline}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 1, md: 1.5 }, maxWidth: 680, fontSize: { xs: '0.85rem', md: '0.95rem' }, lineHeight: 1.5 }}>
            {siteConfig.description}
          </Typography>
          <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`${seriesList.filter((s) => s.enabled).length} 个系列`}
              size="small"
              sx={{ fontWeight: 600, bgcolor: isDark ? 'background.paper' : '#fff', border: 1, borderColor: 'divider' }}
            />
          </Stack>
        </Box>

        {/* 系列宫格 / 列表 */}
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          {/* 标题行 + 布局切换 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
              系列
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={editMode ? '完成排序' : '编辑排序'}>
                <IconButton size="small" onClick={() => setEditMode((v) => !v)} color={editMode ? 'primary' : 'default'}>
                  {editMode ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="紧凑列表">
                <IconButton size="small" onClick={() => setLayoutPersist('list')} color={layout === 'list' ? 'primary' : 'default'}>
                  <ViewListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="卡片视图">
                <IconButton size="small" onClick={() => setLayoutPersist('card')} color={layout === 'card' ? 'primary' : 'default'}>
                  <ViewModuleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <DndContext
            sensors={editMode ? sensors : []}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              {layout === 'card' ? (
                <Box
                  sx={{
                    display: 'grid',
                    gap: { xs: 1, sm: 2 },
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                  }}
                >
                  {orderedSeries.map((s) => (
                    <SeriesCard key={s.id} series={s} consumeDragEnded={consumeDragEnded} editMode={editMode} />
                  ))}
                </Box>
              ) : (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                  {orderedSeries.map((s) => (
                    <SeriesListItem key={s.id} series={s} consumeDragEnded={consumeDragEnded} editMode={editMode} />
                  ))}
                </Box>
              )}
            </SortableContext>
          </DndContext>
        </Box>

        {/* 关于这个站 */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.6, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
            {siteConfig.name} is a multi-series documentation portal. Organize your knowledge into series, write in Markdown, and publish with Mermaid diagrams, KaTeX math, and code highlighting.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              component="a"
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="small"
              startIcon={<GitHubIcon sx={{ fontSize: 18 }} />}
              sx={{ fontWeight: 500 }}
            >
              GitHub
            </Button>
            <Link
              component={RouterLink}
              to="/docs/demo"
              underline="hover"
              sx={{ alignSelf: 'center', fontSize: '0.88rem', fontWeight: 500 }}
            >
              Browse Docs →
            </Link>
          </Stack>
        </Box>
      </Container>
      <PageToolbar />
    </Box>
  )
}

export default HomePage
