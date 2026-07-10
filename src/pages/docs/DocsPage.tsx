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
import Snackbar from '@mui/material/Snackbar'
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { usePersistentState } from '../../utils/usePersistentState'
import HighlightToolbar from '../../components/docs/HighlightToolbar'
import BrushToolbar from '../../components/docs/BrushToolbar'
import HighlightPanel from '../../components/docs/HighlightPanel'
import { useHighlight } from '../../components/docs/useHighlight'
import { localStorageHighlightApi } from '../../data/highlight/localStorage'
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
import { locate } from '../../components/docs/Breadcrumbs'
import ArticlePathBar from '../../components/docs/ArticlePathBar'
import { siteConfig } from '../../config/site'
import PrevNextNavigator from '../../components/docs/PrevNextNavigator'
import SpeechBar from '../../components/docs/SpeechBar'
import { useSpeech } from '../../hooks/useSpeech'
import { useReadingHistory } from '../../hooks/useReadingHistory'

const h1FromContent = (md: string) => md.split('\n').find((l: string) => l.startsWith('# '))?.replace(/^#+\s*/, '') || ''

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
  const { addEntry } = useReadingHistory()
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
  const [fullscreen, setFullscreen] = useState(false)

  // Highlight / Notes
  const highlightSourceType = 'doc'
  const highlightSourceKey = `${seriesId || 'unknown'}/${slug || 'unknown'}`
  const hl = useHighlight({ api: localStorageHighlightApi, sourceType: highlightSourceType, sourceKey: highlightSourceKey })
  useEffect(() => { if (slug) hl.load() }, [slug])

  // ── Highlight helpers ─────────────────────────────────────────────────────
  const BG: Record<string, string> = { yellow:'rgba(250,204,21,0.4)', green:'rgba(74,222,128,0.4)', blue:'rgba(96,165,250,0.4)', pink:'rgba(244,114,182,0.4)', orange:'rgba(251,146,60,0.4)' }

  /** Serialize node path from root element (like rong-admin-ui). */
  function nodePath(node: Node, root: Element): string {
    const p: number[] = []
    let n: Node | null = node
    while (n && n !== root) {
      const parent: Node | null = n.parentNode
      if (!parent) break
      p.unshift(Array.from(parent.childNodes).indexOf(n as ChildNode))
      n = parent
    }
    return p.join('/')
  }

  function resolvePath(path: string, root: Element): Node | null {
    if (!path) return root
    return path.split('/').map(Number).reduce<Node | null>((cur, idx) => cur?.childNodes[idx] ?? null, root)
  }

  function createMark(color: string, id?: number): HTMLElement {
    const m = document.createElement('mark')
    m.className = 'kb-hl-mark'
    m.dataset.hlColor = color
    if (id != null) m.dataset.hlId = String(id)
    m.style.cssText = `background:${BG[color] || BG.yellow};border-radius:2px;padding:0 1px;cursor:default;position:relative`
    return m
  }

  /** Attach delete button AFTER surroundContents (which clears children). */
  function attachDeleteBtn(mark: HTMLElement) {
    if (mark.querySelector('.kb-hl-del')) return
    const del = document.createElement('span')
    del.className = 'kb-hl-del'
    del.textContent = '×'
    del.style.cssText = 'display:none;position:absolute;top:-7px;right:-5px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:#fff;font-size:11px;line-height:16px;text-align:center;cursor:pointer;z-index:1'
    del.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const m = (ev.target as HTMLElement).closest('.kb-hl-mark') as HTMLElement | null
      if (!m) return
      const mid = Number(m.dataset.hlId)
      if (!mid) return
      const p = m.parentNode
      if (p) { while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize() }
      hl.remove(mid)
    })
    mark.appendChild(del)
  }

  /** Apply <mark> to range, with TreeWalker fallback for cross-node selections. */
  function applyMark(range: Range, color: string, id?: number) {
    try {
      const m = createMark(color, id)
      range.surroundContents(m)
      attachDeleteBtn(m)
    } catch {
      // Cross-node: split by text nodes
      const tw = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const r = document.createRange(); r.selectNodeContents(n)
          return range.compareBoundaryPoints(Range.END_TO_START, r) < 0 && range.compareBoundaryPoints(Range.START_TO_END, r) > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }
      })
      const nodes: Text[] = []
      while (tw.nextNode()) nodes.push(tw.currentNode as Text)
      for (const tn of nodes) {
        const nr = document.createRange()
        if (tn === range.startContainer) { nr.setStart(tn, range.startOffset); nr.setEnd(tn, tn.length) }
        else if (tn === range.endContainer) { nr.setStart(tn, 0); nr.setEnd(tn, range.endOffset) }
        else nr.selectNodeContents(tn)
        const m = createMark(color, id)
        try { nr.surroundContents(m); attachDeleteBtn(m) } catch {}
      }
    }
  }

  /** Remove all highlight marks from content area. */
  function removeAllMarks() {
    document.querySelectorAll('#article-content .kb-hl-mark').forEach(m => {
      const p = m.parentNode; if (p) { while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize() }
    })
  }

  // Restore highlight marks after content renders using serialized ranges
  const restoreDone = useRef(false)
  useEffect(() => {
    if (!content || hl.highlights.length === 0) { restoreDone.current = false; return }
    // Only restore once per content+highlights combination
    const key = `${content.length}-${hl.highlights.length}`
    if (restoreDone.current === key as any) return
    const timer = setTimeout(() => {
      const root = document.getElementById('article-content')
      if (!root) return
      removeAllMarks()
      for (const h of hl.highlights) {
        try {
          const sr = JSON.parse(h.serialized_range)
          const sn = resolvePath(sr.startContainerPath || sr.startPath, root)
          const en = resolvePath(sr.endContainerPath || sr.endPath, root)
          if (!sn || !en) continue
          const r = document.createRange()
          r.setStart(sn, sr.startOffset); r.setEnd(en, sr.endOffset)
          applyMark(r, h.color, h.id)
        } catch {}
      }
      restoreDone.current = key as any
    }, 500)
    return () => clearTimeout(timer)
  }, [content, hl.highlights])

  // 系列短标题(用于复制路径)
  const [seriesShortTitle, setSeriesShortTitle] = useState('')
  useEffect(() => {
    if (!seriesId) return
    getSeries(seriesId).then(s => {
      setSeriesShortTitle(s?.shortTitle || s?.title || seriesId)
    })
  }, [seriesId])

  // 复制路径 toast
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' })

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
        // Record reading history
        addEntry(slug, h1FromContent(docContent) || slug, seriesId || '')
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
        seriesId={seriesId}
        columns={parseInt(localStorage.getItem('kbbook-toolbar-columns') || '1')}
        extraButtons={
          <>
            {/* Highlight / Notes */}
            <HighlightToolbar
              brushMode={hl.brushMode} panelOpen={hl.panelOpen}
              highlightCount={hl.highlights.length}
              onToggleBrush={() => hl.setBrushMode(!hl.brushMode)}
              onTogglePanel={() => hl.setPanelOpen(!hl.panelOpen)}
            />

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
            {/* Copy path */}
            <Tooltip title="复制路径" placement="left">
              <span>
                <IconButton size="small" disabled={!content}
                  onClick={() => {
                    const { groupTitle, articleTitle } = locate(docs, slug || '')
                    const path = [siteConfig.name, seriesShortTitle, groupTitle, articleTitle]
                      .filter(Boolean)
                      .join(' › ')
                    navigator.clipboard.writeText(path).then(() => {
                      setToast({ open: true, message: path })
                    }).catch(() => {})
                  }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {/* Article tools: font scale + sticky title */}
            <ArticleToolPanel
              fontScale={fontScale}
              onFontScaleChange={handleFontScaleChange}
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
            id="article-content"
            sx={{
              flex: 1,
              minWidth: 0,
              py: 5,
              px: { xs: 3, sm: 4, md: 6 },
            }}
            onMouseUp={() => {
              if (!hl.brushMode) return
              const sel = window.getSelection()
              if (!sel || sel.isCollapsed || !sel.rangeCount) return
              const text = sel.toString().trim()
              if (!text) return
              const range = sel.getRangeAt(0)
              const root = document.getElementById('article-content')
              if (!root || !root.contains(range.commonAncestorContainer)) return

              // Detect overlapping highlights (like rong-admin-ui collectOverlappingHighlightIds)
              const overlapIds = new Set<number>()
              document.querySelectorAll('#article-content .kb-hl-mark[data-hl-id]').forEach(m => {
                if (range.intersectsNode(m)) {
                  const id = Number((m as HTMLElement).dataset.hlId)
                  if (id) overlapIds.add(id)
                }
              })
              // Remove overlapping marks visually
              overlapIds.forEach(id => {
                document.querySelectorAll(`#article-content .kb-hl-mark[data-hl-id="${id}"]`).forEach(m => {
                  const p = m.parentNode
                  if (p) { while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize() }
                })
                hl.remove(id)
              })

              // Serialize range
              const sr = {
                startContainerPath: nodePath(range.startContainer, root),
                startOffset: range.startOffset,
                endContainerPath: nodePath(range.endContainer, root),
                endOffset: range.endOffset,
              }
              const rangeJson = JSON.stringify(sr)
              hl.create(text, rangeJson).then(item => {
                if (item) {
                  applyMark(range, hl.activeColor, item.id)
                  sel.removeAllRanges()
                }
              })
            }}
            // Hover on mark → show delete button; click × to delete
            // (onClick removed — delete only via × button)
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
                  <ArticlePathBar seriesId={seriesId} slug={slug} docs={docs} />
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

      {/* Copy path toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={toast.message}
        sx={{
          '& .MuiSnackbarContent-root': {
            maxWidth: 600,
            fontSize: '0.82rem',
          },
        }}
      />

      {/* Brush floating toolbar */}
      <BrushToolbar
        open={hl.brushMode}
        activeColor={hl.activeColor}
        onSelectColor={hl.setActiveColor}
        onClose={() => hl.setBrushMode(false)}
      />

      {/* Highlight / Notes Panel */}
      <HighlightPanel
        open={hl.panelOpen}
        highlights={hl.highlights}
        loading={hl.loading}
        editingId={hl.editingId}
        editingText={hl.editingText}
        onClose={() => hl.setPanelOpen(false)}
        onDelete={hl.remove}
        onStartEdit={hl.startEdit}
        onSaveNote={hl.saveNote}
        onCancelNote={hl.cancelNote}
        onEditingTextChange={hl.setEditingText}
        onCopyAll={async () => { const t = await hl.copyAll(); if (t) navigator.clipboard.writeText(t) }}
        onClearAll={hl.clearAll}
      />
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
