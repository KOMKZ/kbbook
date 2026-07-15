import React, { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link as RouterLink } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Prism from 'prismjs'
import mermaid from 'mermaid'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useMermaidZoom } from './useMermaidZoom'
import MermaidFullscreen from './MermaidFullscreen'
import ImageViewer from './ImageViewer'
import WideTable from './WideTable'
import { useMermaidCache } from './useMermaidCache'

// Prism 语言支持
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-sql'

/**
 * Markdown 渲染器
 * 
 * 设计要点：
 * - 标题层级清晰，H1 像页面标题，H2 像章节分割
 * - 正文阅读舒适，行高 1.7，宽度受限
 * - 代码块精致，深色背景 + 语言标签 + 复制按钮
 * - 表格专业，Header 有背景，行 hover
 */

// 全局渲染计数器
let mermaidRenderCount = 0

// Mermaid 主题配置
const mermaidThemes = {
  dark: {
    theme: 'dark' as const,
    themeVariables: {
      primaryColor: '#818cf8',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#a5b4fc',
      lineColor: '#cbd5e1',
      secondaryColor: '#312e81',
      tertiaryColor: '#4338ca',
      background: '#0b0815',
      mainBkg: '#1e1b4b',
      textColor: '#f1f5f9',
      fontSize: '14px',
    },
  },
  light: {
    theme: 'default' as const,
    themeVariables: {
      primaryColor: '#4f46e5',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#818cf8',
      lineColor: '#334155',
      secondaryColor: '#e0e7ff',
      tertiaryColor: '#c7d2fe',
      background: '#ffffff',
      mainBkg: '#eef2ff',
      textColor: '#0f172a',
      fontSize: '14px',
    },
  },
}

interface MarkdownRendererProps {
  content: string
  /** 整体缩放比例(1 = 100%),所有元素按比例同步缩放 */
  scale?: number
}

/** 文章主标题 H1(普通标题,随内容一起向上滚动) */
const PlainH1 = ({ children }: { children: ReactNode }) => (
  <Typography
    variant="h1"
    component="h1"
    sx={{
      mt: 0,
      mb: 3,
      color: 'text.primary',
    }}
  >
    {children}
  </Typography>
)

const MarkdownRenderer = ({ content, scale = 1 }: MarkdownRendererProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const [renderKey, setRenderKey] = useState(0)
  // 缓存已渲染的 Mermaid SVG —— React 重渲染时从 state 取出，
  // 避免因 Virtual DOM 里 mermaid-block 是空的而清掉直接写入的 SVG。
  const [mermaidSvgs, setMermaidSvgs] = useState<Record<string, string>>({})
  const [imageViewer, setImageViewer] = useState<{ src: string; label: string } | null>(null)

  const {
    fullscreenSvg,
    isPng: fullscreenIsPng,
    zoomPercent,
    isDragging,
    canvasRef,
    contentRef,
    openFullscreen,
    closeFullscreen,
    zoomIn,
    zoomOut,
    resetView,
    onWheel,
    onDragStart,
    onTouchStart,
  } = useMermaidZoom()

  // Mermaid PNG cache (tablet/mobile only, PC falls through)
  const { getMermaidPng, cacheSvgLater } = useMermaidCache()

  // Mermaid 初始化
  useEffect(() => {
    const themeConfig = isDark ? mermaidThemes.dark : mermaidThemes.light
    mermaid.initialize({ startOnLoad: false, ...themeConfig })
  }, [isDark])

  // Prism 代码高亮
  useEffect(() => {
    Prism.highlightAll()
  }, [content, renderKey])

  // 主题切换:清空已缓存 SVG 并重渲染,换用对应主题配色
  useEffect(() => { setMermaidSvgs({}); setRenderKey(k => k + 1) }, [isDark])

  // Mermaid 懒渲染 —— 避免"图多的文章一进来就把所有图表同步生成"阻塞阅读/滚动。
  // 只渲染滚到视口附近(±800px)的图,逐个 rAF 让出主线程;每次重新查 DOM(react-markdown
  // 重渲染会重建节点,不能缓存节点引用),用 done 集合按图源去重;背景 SVG→PNG 缓存延到空闲。
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    let cancelled = false
    let running = false
    let ticking = false
    const done = new Set<string>()

    const nearViewport = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.bottom > -800 && r.top < window.innerHeight + 800
    }

    // 找到"视口附近、尚未渲染"的下一张图并渲染,渲完继续排下一张(rAF 让步)
    const pump = async () => {
      if (cancelled || running) return
      const block = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block')).find((b) => {
        const c = b.getAttribute('data-code')
        return !!c && !done.has(c) && nearViewport(b)
      })
      if (!block) return
      const code = block.getAttribute('data-code') as string
      done.add(code) // 立刻标记,防止异步渲染期间被重复选中
      running = true
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${mermaidRenderCount++}`, code)
        if (!cancelled) {
          setMermaidSvgs((prev) => (prev[code] ? prev : { ...prev, [code]: svg }))
          cacheSvgLater(code, svg, isDark) // SVG→PNG 缓存(全屏图片模式用);重活在 Image.onload 内异步,不阻塞渲染/滚动
        }
      } catch {
        if (!cancelled) setMermaidSvgs((prev) => (code in prev ? prev : { ...prev, [code]: '' }))
      }
      running = false
      if (!cancelled) requestAnimationFrame(pump)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { ticking = false; pump() })
    }

    // 首屏 + 补跑:阅读位置恢复会在挂载后(最迟 ~1500ms)把页面滚到记忆位置,
    // 补几次 pump 覆盖"落在某处但没有后续滚动"的情况,避免该处图表一直停在 loading。
    pump()
    const timers = [200, 700, 1600, 2600].map((d) => window.setTimeout(pump, d))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelled = true
      timers.forEach((t) => clearTimeout(t))
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [renderKey, isDark, cacheSvgLater])

  useEffect(() => {
    setRenderKey(prev => prev + 1)
  }, [content])

  return (
    <Box
      ref={containerRef}
      style={{ zoom: scale, '--reader-scale': scale } as CSSProperties}
      sx={{
        // 内容区最大宽度随字体缩放等比放大——放大字体时内容铺满屏幕，不再留大段空白
        maxWidth: `min(${Math.round(780 * scale)}px, 100%)`,
        mx: 'auto',
        // Mermaid 块样式
        '& .mermaid-block': {
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          my: 4,
          p: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'grey.50',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          overflow: 'auto',
          // 悬停时显示全屏按钮（按钮是 React 子元素，不会被 innerHTML 冲掉）
          '&:hover .mermaid-fullscreen-btn': {
            opacity: 1,
          },
        },
        '& .mermaid-svg-wrapper': {
          width: '100%',
        },
        '& .mermaid-svg-wrapper svg': {
          maxWidth: '100%',
          height: 'auto',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          // ========================================
          // 标题系统 - 层级分明
          // ========================================
          
          // H1: 页面主标题 - 可切换是否吸顶
          h1: ({ children }) => <PlainH1>{children}</PlainH1>,

          // H2: 章节标题 - 像分割线
          h2: ({ children }) => (
            <Typography
              variant="h2"
              component="h2"
              id={String(children).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')}
              sx={{
                mt: 6,
                mb: 2,
                pt: 4,
                borderTop: 1,
                borderColor: 'divider',
                color: 'text.primary',
                // 滚动定位偏移
                scrollMarginTop: 80,
              }}
            >
              {children}
            </Typography>
          ),

          // H3: 小节标题
          h3: ({ children }) => (
            <Typography
              variant="h3"
              component="h3"
              id={String(children).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')}
              sx={{
                mt: 4,
                mb: 1.5,
                color: 'text.primary',
                scrollMarginTop: 80,
              }}
            >
              {children}
            </Typography>
          ),

          // H4-H6
          h4: ({ children }) => (
            <Typography variant="h4" component="h4" sx={{ mt: 3, mb: 1, color: 'text.primary' }}>
              {children}
            </Typography>
          ),
          h5: ({ children }) => (
            <Typography variant="h5" component="h5" sx={{ mt: 2, mb: 1, color: 'text.primary' }}>
              {children}
            </Typography>
          ),
          h6: ({ children }) => (
            <Typography variant="h6" component="h6" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
              {children}
            </Typography>
          ),

          // ========================================
          // 正文 - 阅读舒适
          // ========================================
          
          p: ({ children }) => (
            <Typography
              variant="body1"
              component="p"
              sx={{
                mb: 2.5,
                color: 'text.primary',
                // 段落之间有呼吸感
                '& + &': { mt: 0 },
              }}
            >
              {children}
            </Typography>
          ),

          // ========================================
          // 链接 - Hover 效果
          // ========================================
          
          a: ({ href, children }) => {
            const linkSx = {
              color: 'primary.main',
              fontWeight: 500,
              textDecoration: 'none',
              borderBottom: '1px solid transparent',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderBottomColor: 'primary.main',
              },
            }

            // 外部链接: 原生 <a>,新开页
            if (href && /^(https?:)?\/\//.test(href)) {
              return (
                <Link href={href} target="_blank" rel="noopener noreferrer" sx={linkSx}>
                  {children}
                </Link>
              )
            }

            // 页内锚点(#section)或空 href: 保持原生 <a>,让浏览器滚动
            if (!href || href.startsWith('#')) {
              return (
                <Link href={href || '#'} sx={linkSx}>
                  {children}
                </Link>
              )
            }

            // 文章间 .md 链接: 归一化为 SPA 路由,用 React Router 客户端跳转。
            // 避免 MUI Link href 触发整页原生导航,也避免 .md 被 dev server 当
            // text/markdown 直接下载。路由规范见 DocsSidebar / resolveSlugFromParams:
            //   /docs/{series}/{slug}   (slug 可为多级 group/slug)
            const mdMatch = href.match(/^(.*?)\.md(#.+)?$/)
            if (mdMatch) {
              const anchor = mdMatch[2] ?? ''
              const raw = mdMatch[1]
              let to: string
              if (raw.startsWith('/')) {
                // 已是绝对站内路径,仅剥掉 .md
                to = `${raw}${anchor}`
              } else {
                const rest = raw.replace(/^(?:\.\.?\/)+/, '') // 去掉开头的 ./ 或 ../(可能多层)
                const segs = rest.split('/')
                const curMatch = window.location.pathname.match(/^\/docs\/([^/]+)/)
                const curSeries = curMatch ? curMatch[1] : 'llm'
                if (segs.length > 1 && /-v[\d.]+$/.test(segs[0])) {
                  // 跨系列链接: {series}-{version}/slug… → /docs/{series}/{slug…}
                  const targetSeries = segs[0].replace(/-v[\d.]+$/, '')
                  to = `/docs/${targetSeries}/${segs.slice(1).join('/')}${anchor}`
                } else {
                  // 同系列(平铺文件名,或 group/slug 嵌套)
                  to = `/docs/${curSeries}/${rest}${anchor}`
                }
              }
              return (
                <Link component={RouterLink} to={to} sx={linkSx}>
                  {children}
                </Link>
              )
            }

            // 其它内部链接(非 .md,如 demo 源码 ../demos/x/main.go): 保持原生 <a>,行为不变
            return (
              <Link href={href} sx={linkSx}>
                {children}
              </Link>
            )
          },

          // ========================================
          // 引用块 - 精致边框
          // ========================================
          
          blockquote: ({ children }) => (
            <Box
              component="blockquote"
              sx={{
                my: 3,
                mx: 0,
                pl: 2.5,
                py: 0.5,
                borderLeft: 3,
                borderColor: 'primary.main',
                bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'primary.50',
                borderRadius: '0 8px 8px 0',
                '& p': { 
                  mb: 0,
                  color: isDark ? 'grey.300' : 'grey.700',
                },
              }}
            >
              {children}
            </Box>
          ),

          // ========================================
          // 代码 - 最重要的部分
          // ========================================
          
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const codeString = String(children).replace(/\n$/, '')

            // Mermaid 图表
            if (language === 'mermaid') {
              const cachedSvg = mermaidSvgs[codeString]
              const isError = cachedSvg === ''
              const isPending = cachedSvg === undefined
              return (
                <div className="mermaid-block" data-code={codeString}>
                  {isError ? (
                    <Box sx={{ color: '#ef4444', py: 2 }}>Mermaid render failed</Box>
                  ) : isPending ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 4, minHeight: 80, color: 'text.secondary' }}>
                      <CircularProgress size={18} thickness={5} />
                      <Typography variant="caption">图表生成中…</Typography>
                    </Box>
                  ) : (
                    <Box
                      className="mermaid-svg-wrapper"
                      sx={{ width: '100%' }}
                      dangerouslySetInnerHTML={{ __html: cachedSvg }}
                    />
                  )}
                  <Box
                    component="button"
                    className="mermaid-fullscreen-btn"
                    title="Fullscreen"
                    aria-label="View diagram fullscreen"
                    onClick={async (e: React.MouseEvent) => {
                      e.stopPropagation()
                      // Button is direct child of mermaid-block, which has data-code
                      const block = (e.currentTarget as HTMLElement).parentElement
                      const code = block?.getAttribute('data-code') || ''
                      // Try PNG cache first (tablet only)
                      const pngUrl = code ? await getMermaidPng(code, isDark) : null
                      if (pngUrl) {
                        setImageViewer({ src: pngUrl, label: `Mermaid · PNG` })
                      } else {
                        const svgEl = block?.querySelector('svg')
                        if (svgEl) openFullscreen(svgEl as SVGElement, false)
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                      borderRadius: '6px',
                      bgcolor: isDark ? 'rgba(30,30,50,0.9)' : 'rgba(255,255,255,0.9)',
                      color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.2s, background-color 0.2s',
                      backdropFilter: 'blur(4px)',
                      p: 0,
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)',
                        color: isDark ? '#a5b4fc' : '#5046e5',
                      },
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </Box>
                </div>
              )
            }

            // 行内代码 - 精致小标签
            if (!className) {
              return (
                <Box
                  component="code"
                  sx={{
                    px: 1,
                    py: 0.25,
                    mx: 0.25,
                    borderRadius: 1,
                    bgcolor: isDark ? 'rgba(129, 140, 248, 0.15)' : 'primary.50',
                    color: isDark ? 'primary.light' : 'primary.dark',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '0.875em',
                    fontWeight: 500,
                  }}
                >
                  {children}
                </Box>
              )
            }

            // 代码块 - 深色背景 + 语言标签 + 复制按钮
            return (
              <CodeBlock language={language} code={codeString} isDark={isDark} />
            )
          },

          // ========================================
          // 表格 - 专业风格
          // ========================================
          
          table: ({ children }) => <WideTable>{children}</WideTable>,
          thead: ({ children }) => <TableHead>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => (
            <TableRow 
              sx={{ 
                '&:hover': { 
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'grey.50' 
                } 
              }}
            >
              {children}
            </TableRow>
          ),
          th: ({ children }) => (
            <TableCell
              sx={{
                fontWeight: 600,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'grey.50',
                borderBottom: 2,
                borderColor: 'divider',
                color: 'text.primary',
                whiteSpace: 'nowrap',
              }}
            >
              {children}
            </TableCell>
          ),
          td: ({ children }) => (
            <TableCell sx={{ borderColor: 'divider' }}>
              {children}
            </TableCell>
          ),

          // ========================================
          // 列表 - 缩进层级
          // ========================================
          
          ul: ({ children }) => (
            <Box 
              component="ul" 
              sx={{ 
                pl: 3, 
                mb: 2.5,
                '& li': {
                  mb: 0.75,
                },
                // 嵌套列表
                '& ul, & ol': {
                  mt: 0.75,
                  mb: 0,
                },
              }}
            >
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box 
              component="ol" 
              sx={{ 
                pl: 3, 
                mb: 2.5,
                '& li': {
                  mb: 0.75,
                },
              }}
            >
              {children}
            </Box>
          ),
          li: ({ children, ...props }) => {
            const isTaskItem = props.className?.includes('task-list-item')
            if (isTaskItem) {
              return (
                <Box 
                  component="li" 
                  sx={{ 
                    listStyle: 'none', 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 0.5,
                    ml: -2.5,
                  }}
                >
                  {children}
                </Box>
              )
            }
            return (
              <Box 
                component="li" 
                sx={{ 
                  color: 'text.primary',
                  '&::marker': {
                    color: 'primary.main',
                  },
                }}
              >
                {children}
              </Box>
            )
          },
          input: ({ checked }) => (
            <Checkbox 
              checked={checked} 
              size="small" 
              disabled 
              sx={{ 
                p: 0, 
                mr: 1,
                color: 'grey.400',
                '&.Mui-checked': {
                  color: 'primary.main',
                },
              }} 
            />
          ),

          // ========================================
          // 分隔线
          // ========================================
          
          hr: () => (
            <Divider 
              sx={{ 
                my: 5,
                borderColor: 'divider',
              }} 
            />
          ),

          // ========================================
          // 图片
          // ========================================
          
          img: ({ src, alt }) => (
            <Box
              component="img"
              src={src}
              alt={alt}
              sx={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 2,
                my: 3,
                border: 1,
                borderColor: 'divider',
              }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {fullscreenSvg && (
        <MermaidFullscreen
          svgHtml={fullscreenSvg}
          zoomPercent={zoomPercent}
          isDragging={isDragging}
          isPng={fullscreenIsPng}
          canvasRef={canvasRef}
          contentRef={contentRef}
          onClose={closeFullscreen}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
          onWheel={onWheel}
          onDragStart={onDragStart}
          onTouchStart={onTouchStart}
        />
      )}

      {/* Image viewer for cached PNGs */}
      <ImageViewer
        open={!!imageViewer}
        src={imageViewer?.src || ''}
        label={imageViewer?.label}
        isDark={isDark}
        onClose={() => setImageViewer(null)}
      />
    </Box>
  )
}

// ========================================
// 代码块组件 - 带复制按钮
// ========================================

interface CodeBlockProps {
  language: string
  code: string
  isDark: boolean
}

const CodeBlock = ({ language, code, isDark }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 语言标签映射
  const languageLabels: Record<string, string> = {
    go: 'Go',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    javascript: 'JavaScript',
    js: 'JavaScript',
    bash: 'Bash',
    shell: 'Shell',
    yaml: 'YAML',
    yml: 'YAML',
    json: 'JSON',
    sql: 'SQL',
    markdown: 'Markdown',
    md: 'Markdown',
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        my: 3,
        overflow: 'hidden',
        borderRadius: 2,
        // 代码块始终使用深色背景 - 更专业
        bgcolor: '#1e1e2e',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'grey.300',
      }}
    >
      {/* 顶部工具栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          bgcolor: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* 语言标签 */}
        <Typography
          variant="caption"
          sx={{
            color: 'grey.400',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 500,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {languageLabels[language] || language || 'Code'}
        </Typography>

        {/* 复制按钮 */}
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              color: copied ? 'success.main' : 'grey.500',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 代码内容 */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          overflow: 'auto',
          fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
          fontSize: '0.85rem',
          lineHeight: 1.7,
          color: '#abb2bf',
          // 自定义滚动条
          '&::-webkit-scrollbar': {
            height: 6,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.15)',
            borderRadius: 3,
          },
        }}
      >
        <code className={`language-${language}`}>{code}</code>
      </Box>
    </Paper>
  )
}

export default React.memo(MarkdownRenderer)
