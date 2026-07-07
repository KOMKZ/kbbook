import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'

import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Tooltip from '@mui/material/Tooltip'
import HomeIcon from '@mui/icons-material/Home'
import MenuIcon from '@mui/icons-material/Menu'
import TocIcon from '@mui/icons-material/Toc'
import CloseIcon from '@mui/icons-material/Close'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'
import DocsSidebar from '../../components/docs/DocsSidebar'
import MarkdownRenderer from '../../components/docs/MarkdownRenderer'
import TableOfContents from '../../components/docs/TableOfContents'
import PageToolbar from '../../components/docs/PageToolbar'
import ArticleToolPanel, { FONT_SCALE_MIN, FONT_SCALE_MAX } from '../../components/docs/ArticleToolPanel'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import StopIcon from '@mui/icons-material/Stop'
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver'
import { usePersistentState } from '../../utils/usePersistentState'
import {
  loadVersions,
  loadDocsMeta,
  loadDocContent,
  getResolvedVersions,
  clearDocsCache,
  getCurrentLanguage,
  resolveSlugFromParams,
  getSeries,
  loadSeriesRegistry,
  type ResolvedVersionInfo,
  type DocMeta,
} from '../../utils/docs'
import Breadcrumbs from '../../components/docs/Breadcrumbs'
import PrevNextNavigator from '../../components/docs/PrevNextNavigator'
import SpeechBar from '../../components/docs/SpeechBar'
import { useSpeech } from '../../hooks/useSpeech'

interface ReadingPosition {
  top: number
  ratio: number
  updatedAt: number
}

const READING_POSITION_NS = 'lz-reader:readingPosition:'

const getReadingPositionKey = (seriesId?: string, version?: string, slug?: string) => {
  if (!seriesId || !version || !slug) return null
  return `${READING_POSITION_NS}${seriesId}:${version}:${slug}`
}

const readReadingPosition = (key: string): ReadingPosition | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ReadingPosition>
    if (typeof parsed.top !== 'number' || typeof parsed.ratio !== 'number') return null
    return {
      top: Math.max(0, parsed.top),
      ratio: Math.min(1, Math.max(0, parsed.ratio)),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return null
  }
}

const writeReadingPosition = (key: string) => {
  try {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const top = Math.max(0, window.scrollY)
    const position: ReadingPosition = {
      top,
      ratio: max > 0 ? Math.min(1, top / max) : 0,
      updatedAt: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(position))
  } catch {
    // localStorage 不可用时仅放弃本地记忆,不影响阅读。
  }
}

const findDocTitle = (items: DocMeta[], targetSlug?: string): string | undefined => {
  if (!targetSlug) return undefined
  for (const item of items) {
    if (item.slug === targetSlug) return item.title
    if (item.items) {
      const innerTitle = findDocTitle(item.items, targetSlug)
      if (innerTitle) return innerTitle
    }
  }
  return undefined
}

/**
 * 文档页面
 * 
 * 三栏布局：Sidebar + Content + TOC
 */
const DocsPage = () => {
  const params = useParams()
  const seriesId = params.series
  // 统一 slug 解析(避免每个组件独立拼接,见 utils/docs.ts:resolveSlugFromParams)
  const slug = resolveSlugFromParams(params)
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  useTheme() // 保持主题响应

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versions, setVersions] = useState<ResolvedVersionInfo[]>([])
  const [docs, setDocs] = useState<DocMeta[]>([])
  const [content, setContent] = useState('')
  const [contentSlug, setContentSlug] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>('sidebar.collapsed', false)

  // 阅读器:整体字号缩放(持久化)+ 全屏阅读
  // 全屏 / 非全屏 的字号分开记忆,互不影响
  const inRange = (v: number) => v >= FONT_SCALE_MIN && v <= FONT_SCALE_MAX
  const [fontScaleNormal, setFontScaleNormal] = usePersistentState<number>('fontScale.normal', 1, inRange)
  const [fontScaleFull, setFontScaleFull] = usePersistentState<number>('fontScale.fullscreen', 1, inRange)
  const [stickyTitleHidden, setStickyTitleHidden] = usePersistentState<boolean>('stickyTitle.hidden', false)
  const [fullscreen, setFullscreen] = useState(false)

  // TTS 朗读 — 提升到 DocsPage 层级共享
  const { state: speechState, progress: speechProgress, speak: speechSpeak, stop: speechStop } = useSpeech()

  // 离开文章页自动停止朗读
  useEffect(() => {
    return () => { speechStop() }
  }, [speechStop])

  // 当前生效的字号 = 看当前是不是全屏
  const fontScale = fullscreen ? fontScaleFull : fontScaleNormal
  const handleFontScaleChange = useCallback(
    (scale: number) => {
      if (fullscreen) setFontScaleFull(scale)
      else setFontScaleNormal(scale)
    },
    [fullscreen, setFontScaleFull, setFontScaleNormal],
  )

  // Reading progress — DOM-only update to avoid React re-render on every scroll frame
  const [readProgress, setReadProgress] = useState(0)
  const progressBarRef = useRef<HTMLElement>(null)
  const progressTextRef = useRef<HTMLElement>(null)
  const lastProgressRef = useRef(-1) // throttle React state updates
  useEffect(() => {
    let ticking = false
    const bar = progressBarRef.current
    const text = progressTextRef.current
    const update = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max > 0 ? Math.min(100, Math.round((y / max) * 100)) : 0
      // DOM update (no React re-render) — fast path via CSS custom properties
      if (bar) {
        bar.style.setProperty('--progress-pct', String(pct))
        bar.style.setProperty('--progress-color', pct > 0 ? '#5046e5' : 'transparent')
      }
      if (text) text.textContent = String(pct)
      // Throttled React update — only every 10% change, for tooltip + ArticleToolPanel
      if (Math.abs(pct - lastProgressRef.current) >= 10) {
        lastProgressRef.current = pct
        setReadProgress(pct)
      }
      ticking = false
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update) }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Esc 退出全屏
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // 切换移动端侧边栏
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  // 点击文档链接后关闭侧边栏,阅读位置由下方 effect 决定恢复或回顶。
  useEffect(() => {
    setMobileOpen(false)
  }, [slug])

  // 每篇文章独立记忆阅读位置,切换文章 / 刷新 / 关闭页面时保存到本地。
  useEffect(() => {
    const key = getReadingPositionKey(seriesId, currentVersion, slug)
    if (!key || loading || !content || contentSlug !== slug) return

    let frame: number | null = null
    const save = () => {
      frame = null
      writeReadingPosition(key)
    }
    const scheduleSave = () => {
      if (frame == null) frame = window.requestAnimationFrame(save)
    }

    window.addEventListener('scroll', scheduleSave, { passive: true })
    window.addEventListener('resize', scheduleSave)
    window.addEventListener('beforeunload', save)

    return () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      save()
      window.removeEventListener('scroll', scheduleSave)
      window.removeEventListener('resize', scheduleSave)
      window.removeEventListener('beforeunload', save)
    }
  }, [seriesId, currentVersion, slug, loading, content, contentSlug])

  // 内容渲染完成后恢复上次位置;没有历史记录的新文章回到顶部。
  useEffect(() => {
    const key = getReadingPositionKey(seriesId, currentVersion, slug)
    if (!key || loading || !content || contentSlug !== slug) return

    let cancelled = false
    const restore = () => {
      if (cancelled) return
      const saved = readReadingPosition(key)
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const savedTop = saved ? Math.max(saved.top, Math.round(saved.ratio * max)) : 0
      window.scrollTo({ top: Math.min(savedTop, max), behavior: 'instant' })
    }

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restore)
    })
    const lateRestore = window.setTimeout(restore, 250)
    const extraLate = window.setTimeout(restore, 1500)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstFrame)
      window.clearTimeout(lateRestore)
      window.clearTimeout(extraLate)
    }
  }, [seriesId, currentVersion, slug, loading, content, contentSlug])

  // 加载文档
  const loadDocs = useCallback(async () => {
    setLoading(true)
    setError(null)
    setContent('')
    setContentSlug(null)

    try {
      // 加载版本信息(用于版本切换器组件兼容)
      const versionsConfig = await loadVersions()
      const resolvedVersions = getResolvedVersions(versionsConfig.versions)
      setVersions(resolvedVersions)

      // 用 series 解析底层 version + language
      const registry = await loadSeriesRegistry()
      const targetSeriesId = seriesId || registry.defaultSeries
      const series = await getSeries(targetSeriesId)
      if (!series || !series.enabled || !series.version) {
        setError(`Series not available: ${targetSeriesId}`)
        return
      }
      const targetVersion = series.version
      setCurrentVersion(targetVersion)

      // URL 没有 series 时重定向到 default series 的第一篇
      if (!seriesId) {
        navigate(`/docs/${targetSeriesId}/${slug || '001-overview'}`, { replace: true })
        return
      }

      // 加载文档元数据
      const lang = getCurrentLanguage()
      const meta = await loadDocsMeta(targetVersion, lang)
      setDocs(meta.items)

      // URL 没有 slug 时:不再重定向到第一篇,而是让用户停留在系列详情页(由路由层处理)
      if (!slug) {
        navigate(`/docs/${targetSeriesId}`, { replace: true })
        return
      }

      // 加载文档内容
      try {
        const docContent = await loadDocContent(targetVersion, slug, lang)
        setContent(docContent)
        setContentSlug(slug)
      } catch (loadErr) {
        // 文档不存在(包括 Vite SPA fallback 返回 index.html 的"假 200")→ 回到系列详情页
        console.warn(`Doc "${slug}" not found, redirecting to series detail`, loadErr)
        navigate(`/docs/${targetSeriesId}`, { replace: true })
      }
    } catch (err) {
      setError('Failed to load document')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [seriesId, slug, navigate])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  // 语言切换时重新加载
  useEffect(() => {
    const handleLanguageChange = () => {
      clearDocsCache()
      loadDocs()
    }
    i18n.on('languageChanged', handleLanguageChange)
    return () => i18n.off('languageChanged', handleLanguageChange)
  }, [i18n, loadDocs])

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {!fullscreen && <Header />}

      {/* 统一工具栏 */}
      <PageToolbar
        extraButtons={
          <>
            {/* Reading progress — DOM-updated for zero React re-render on scroll */}
            <Tooltip title={`阅读进度 ${readProgress}%`} placement="left">
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.25, position: 'relative' }}>
                <Box ref={progressBarRef}
                  sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'conic-gradient(var(--progress-color, #5046e5) calc(var(--progress-pct, 0) * 1%), transparent 0)',
                    transform: 'rotate(-90deg)',
                    mask: 'radial-gradient(transparent 60%, black 61%)',
                    WebkitMask: 'radial-gradient(transparent 60%, black 61%)',
                  }}
                />
                <Typography ref={progressTextRef}
                  sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: 'text.secondary' }}>
                  {readProgress}
                </Typography>
              </Box>
            </Tooltip>
            {/* Article tools: font scale + sticky title */}
            <ArticleToolPanel
              fontScale={fontScale}
              onFontScaleChange={handleFontScaleChange}
              stickyTitleHidden={stickyTitleHidden}
              onToggleStickyTitle={() => setStickyTitleHidden((v) => !v)}
              readProgress={readProgress}
            />
            {/* TTS */}
            <Tooltip title={speechState === 'speaking' ? '停止朗读' : '朗读文章'} placement="left">
              <span>
                <IconButton size="small" disabled={!content}
                  onClick={() => { if (!content) return; speechState === 'speaking' ? speechStop() : speechSpeak(content) }}
                  color={speechState === 'speaking' ? 'primary' : 'default'}>
                  {speechState === 'speaking' ? <StopIcon fontSize="small" /> : <RecordVoiceOverIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            {/* Fullscreen */}
            <Tooltip title={fullscreen ? '退出全屏' : '全屏'} placement="left">
              <IconButton size="small" onClick={() => setFullscreen((v) => !v)} color={fullscreen ? 'primary' : 'default'}>
                {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {/* Mobile sidebar toggle */}
            <Tooltip title="目录" placement="left" sx={{ display: { md: 'none' } }}>
              <IconButton size="small" onClick={handleDrawerToggle} sx={{ display: { xs: 'flex', md: 'none' } }}>
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {/* Mobile TOC toggle */}
            <Box sx={{ display: { xl: 'none' } }}>
              <Tooltip title="本页目录" placement="left">
                <span>
                  <IconButton size="small" onClick={() => setTocOpen(true)}>
                    <TocIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </>
        }
      />
      <SpeechBar
        state={speechState}
        current={speechProgress.current}
        total={speechProgress.total}
        onStop={speechStop}
      />

      {/* 移动端 TOC Drawer */}
      <Drawer
        variant="temporary"
        anchor="right"
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', xl: 'none' },
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton onClick={() => setTocOpen(false)} aria-label="关闭目录">
            <CloseIcon />
          </IconButton>
        </Box>
        {content ? (
          <TableOfContents content={content} />
        ) : (
          <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', mt: 4 }}>
            文章加载中...
          </Typography>
        )}
      </Drawer>

      {/* 移动端侧边栏 Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            width: 300,
            boxSizing: 'border-box',
          },
        }}
      >
        {/* 关闭按钮 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={handleDrawerToggle} aria-label="关闭目录">
            <CloseIcon />
          </IconButton>
        </Box>
        <DocsSidebar 
          versions={versions} 
          currentVersion={currentVersion} 
          docs={docs}
          seriesId={seriesId}
        />
      </Drawer>

      {/* 主体区域 - Header 下方 */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          pt: fullscreen ? 0 : 'var(--header-height)', // CSS 变量,由 Header 的 ResizeObserver 写入
        }}
      >
        {/* 左侧边栏 - 桌面端:可折叠(折叠后显示窄条 + 展开按钮); 移动端:Drawer */}
        {!fullscreen && (
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'fixed',
              top: 'var(--header-height)',
              left: 0,
              bottom: 0,
              width: sidebarCollapsed ? 40 : 280,
              flexShrink: 0,
              height: 'calc(100vh - var(--header-height))',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              zIndex: 100,
              transition: 'width 0.25s ease',
            }}
          >
            {sidebarCollapsed ? (
              <Box
                sx={{
                  width: 40,
                  height: 'calc(100vh - var(--header-height))',
                  position: 'sticky',
                  top: 'var(--header-height)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pt: 2,
                  borderRight: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => setSidebarCollapsed(false)}
                title="展开目录"
              >
                <MenuIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{ mt: 1, writingMode: 'vertical-rl', color: 'text.secondary', fontSize: '0.65rem', userSelect: 'none' }}
                >
                  目录
                </Typography>
              </Box>
            ) : (
              <>
                <DocsSidebar
                  versions={versions}
                  currentVersion={currentVersion}
                  docs={docs}
                  seriesId={seriesId}
                />
                {/* 折叠按钮:悬浮在侧边栏右边缘 */}
                <IconButton
                  onClick={() => setSidebarCollapsed(true)}
                  title="折叠目录"
                  sx={{
                    position: 'absolute',
                    right: 4,
                    top: 12,
                    width: 24,
                    height: 24,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: 1,
                    zIndex: 10,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <MenuIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </IconButton>
              </>
            )}
          </Box>
        )}

        {/* 主内容区 */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            minWidth: 0,
            ml: { md: fullscreen ? 0 : sidebarCollapsed ? '40px' : '280px' },
            mr: { xl: fullscreen ? 0 : '240px' },
            bgcolor: 'background.paper',
          }}
        >
          {/* 文档内容 */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              py: 5,
              px: { xs: 3, sm: 4, md: 6 },
            }}
          >
            {loading ? (
              <LoadingSkeleton />
            ) : error ? (
              <ErrorState message={error} />
            ) : !content ? (
              <EmptyState />
            ) : (
              <>
                {!fullscreen && seriesId && slug && (
                  <Box sx={{ maxWidth: 780, mx: 'auto', mb: 2 }}>
                    <Breadcrumbs seriesId={seriesId} slug={slug} docs={docs} />
                  </Box>
                )}
                {content && (
                  <Box sx={{ maxWidth: 780, mx: 'auto', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
                      约 {content.replace(/\s/g, '').length >= 400
                        ? Math.max(1, Math.round(content.replace(/\s/g, '').length / 400))
                        : 1} 分钟阅读
                    </Typography>
                  </Box>
                )}
                <MarkdownRenderer
                  content={content}
                  scale={fontScale}
                  headerOffset={fullscreen ? 0 : undefined /* 非全屏时由 CSS 变量 --header-height 控制 */}
                  hideStickyTitle={stickyTitleHidden}
                />
                {seriesId && slug && (
                  <PrevNextNavigator
                    currentSlug={slug}
                    docs={docs}
                    seriesId={seriesId}
                  />
                )}
              </>
            )}
          </Box>

          {/* 右侧 TOC(全屏/非桌面时隐藏) */}
          <Box
            sx={{
              display: fullscreen ? 'none' : { xs: 'none', xl: 'block' },
              position: 'fixed',
              top: 'var(--header-height)',
              right: 0,
              bottom: 0,
              width: { xl: 240 },
              height: 'calc(100vh - var(--header-height))',
              overflow: 'hidden',
              flexShrink: 0,
              py: 5,
              pr: { xl: 4 },
              bgcolor: 'background.paper',
            }}
          >
            {!loading && content && <TableOfContents content={content} />}
          </Box>
        </Box>
      </Box>

      {!fullscreen && <Footer />}
    </Box>
  )
}

/**
 * 加载骨架屏
 */
const LoadingSkeleton = () => (
  <Box sx={{ maxWidth: 780, mx: 'auto' }}>
    {/* 标题 */}
    <Skeleton 
      variant="text" 
      width="60%" 
      height={48} 
      sx={{ mb: 2 }} 
    />
    {/* 描述 */}
    <Skeleton 
      variant="text" 
      width="80%" 
      height={24} 
      sx={{ mb: 4 }} 
    />
    {/* 段落 */}
    {[1, 2, 3].map((i) => (
      <Box key={i} sx={{ mb: 4 }}>
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="95%" height={20} />
        <Skeleton variant="text" width="90%" height={20} />
        <Skeleton variant="text" width="70%" height={20} />
      </Box>
    ))}
    {/* 代码块 */}
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={200} 
      sx={{ borderRadius: 2, mb: 4 }} 
    />
  </Box>
)

/**
 * 错误状态
 */
const ErrorState = ({ message }: { message: string }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: 'auto',
        py: 8,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="h4"
        fontWeight={600}
        color="text.primary"
        gutterBottom
      >
        {t('docs.notFound.title')}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        {message || t('docs.notFound.message')}
      </Typography>
      <Button
        variant="contained"
        startIcon={<HomeIcon />}
        onClick={() => navigate('/')}
      >
        {t('docs.notFound.backHome')}
      </Button>
    </Box>
  )
}

/**
 * 空状态
 */
const EmptyState = () => {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: 'auto',
        py: 8,
        textAlign: 'center',
      }}
    >
      <Typography
        variant="h5"
        fontWeight={600}
        color="text.secondary"
        gutterBottom
      >
        {t('docs.notFound.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('docs.notFound.message')}
      </Typography>
    </Box>
  )
}

export default DocsPage
