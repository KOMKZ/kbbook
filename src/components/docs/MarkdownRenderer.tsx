import React, { useEffect, useRef, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
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
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
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
      primaryColor: '#6366f1',
      primaryTextColor: '#fff',
      primaryBorderColor: '#818cf8',
      lineColor: '#94a3b8',
      secondaryColor: '#1e1b4b',
      tertiaryColor: '#312e81',
      background: '#0f0a1f',
      mainBkg: '#1e1b4b',
      textColor: '#e2e8f0',
      fontSize: '14px',
    },
  },
  light: {
    theme: 'default' as const,
    themeVariables: {
      primaryColor: '#5046e5',
      primaryTextColor: '#0f172a',
      primaryBorderColor: '#a5b4fc',
      lineColor: '#64748b',
      secondaryColor: '#e0e7ff',
      tertiaryColor: '#c7d2fe',
      background: '#f8fafc',
      mainBkg: '#e0e7ff',
      textColor: '#0f172a',
      fontSize: '14px',
    },
  },
}

interface MarkdownRendererProps {
  content: string
  /** 整体缩放比例(1 = 100%),所有元素按比例同步缩放 */
  scale?: number
  /** 吸顶标题要避让的顶栏高度(px)。全屏无顶栏时传 0 */
  headerOffset?: number
  hideStickyTitle?: boolean
}

/**
 * 吸顶 H1:滚动时固定在顶部,带"复制标题"按钮(复制 [TXX-AYY] 编码 + 标题文本)
 */
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

const StickyH1 = ({ children }: { children: ReactNode }) => {
  const [copied, setCopied] = useState(false)
  const titleText = String(
    Array.isArray(children)
      ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
      : children,
  )
  const handleCopy = useCallback(() => {
    if (!titleText) return
    navigator.clipboard.writeText(titleText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [titleText])

  return (
    <Box
      sx={(theme) => ({
        position: 'sticky',
        // zoom 缩放下顶部偏移会被一起放大导致吸顶错位;除以缩放比例抵消。
        // 偏移量随模式变化:正常 = 顶栏高度,全屏 = 0(见根容器 --reader-sticky-top / --reader-scale)
        top: 'calc(var(--reader-sticky-top, var(--header-height, 64px)) / var(--reader-scale, 1))',
        zIndex: 10,
        mt: 0,
        mb: 3,
        pt: 2,
        pb: 1.5,
        borderBottom: 2,
        borderColor: 'primary.main',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(18, 18, 18, 0.92)' : 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      })}
    >
      <Typography
        variant="h1"
        component="h1"
        sx={{
          m: 0,
          color: 'text.primary',
          flex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </Typography>
      <Tooltip title={copied ? '已复制' : '复制标题'} placement="left">
        <IconButton
          onClick={handleCopy}
          size="small"
          sx={{
            flexShrink: 0,
            color: copied ? 'success.main' : 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

const MarkdownRenderer = ({ content, scale = 1, headerOffset = 64, hideStickyTitle = false }: MarkdownRendererProps) => {
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

  // Mermaid 渲染
  const renderMermaidDiagrams = useCallback(async () => {
    if (!containerRef.current) return
    const mermaidBlocks = containerRef.current.querySelectorAll('.mermaid-block')

    const newSvgs: Record<string, string> = {}

    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i] as HTMLElement
      const code = block.getAttribute('data-code')
      // 跳过已渲染的：检查 mermaid-svg-wrapper 里是否有 SVG（排除全屏按钮里的图标 SVG）
      if (!code || block.querySelector('.mermaid-svg-wrapper svg')) continue

      try {
        const uniqueId = `mermaid-${Date.now()}-${mermaidRenderCount++}`
        const { svg } = await mermaid.render(uniqueId, code)
        newSvgs[code] = svg
        // Background: convert SVG to PNG and cache for fullscreen (tablet only)
        cacheSvgLater(code, svg)
      } catch {
        newSvgs[code] = ''
      }
    }

    // 批量缓存到 React state —— 触发重渲染后 React 通过 dangerouslySetInnerHTML 写入 SVG
    if (Object.keys(newSvgs).length > 0) {
      setMermaidSvgs(prev => ({ ...prev, ...newSvgs }))
    }
  }, [])

  useEffect(() => {
    Prism.highlightAll()
    const timer = setTimeout(renderMermaidDiagrams, 100)
    return () => clearTimeout(timer)
  }, [content, renderKey, renderMermaidDiagrams])

  useEffect(() => {
    setRenderKey(prev => prev + 1)
  }, [content])

  return (
    <Box
      ref={containerRef}
      style={{ zoom: scale, '--reader-scale': scale, '--reader-sticky-top': `${headerOffset}px` } as CSSProperties}
      sx={{
        // 内容区最大宽度限制 - 提升阅读舒适度
        maxWidth: 780,
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
          h1: ({ children }) => (hideStickyTitle ? <PlainH1>{children}</PlainH1> : <StickyH1>{children}</StickyH1>),

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
            let resolvedHref = href
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
              // 支持可选 #fragment 后缀,统一拼回 resolvedHref。
              // 同层平铺: ./T00-A01-abc.md(#anchor)?
              const flatMatch = href.match(/^\.\/([\w.-]+)\.md(#.+)?$/)
              // 嵌套子目录(单级): ./refs/T00-A02-S01-abc.md(#anchor)?
              const nestedMatch = href.match(/^\.\/([\w.-]+)\/([\w.-]+)\.md(#.+)?$/)
              // 父级到同层子目录: references/T00-A02-S01-abc.md(#anchor)?
              const nestedNoDotMatch = href.match(/^([\w.-]+)\/([\w.-]+)\.md(#.+)?$/)
              // 子文档回到上层: ../T00-A02-symbolism.md(#anchor)?
              const parentMatch = href.match(/^\.\.\/([\w.-]+)\.md(#.+)?$/)
              const currentPath = window.location.pathname
              const versionMatch = currentPath.match(/\/docs\/(v[\d.]+)/)
              const ver = versionMatch ? versionMatch[1] : 'v0.1.0'
              if (parentMatch) {
                resolvedHref = `/docs/${ver}/${parentMatch[1]}${parentMatch[2] ?? ''}`
              } else if (nestedMatch) {
                resolvedHref = `/docs/${ver}/${nestedMatch[1]}/${nestedMatch[2]}${nestedMatch[3] ?? ''}`
              } else if (nestedNoDotMatch) {
                resolvedHref = `/docs/${ver}/${nestedNoDotMatch[1]}/${nestedNoDotMatch[2]}${nestedNoDotMatch[3] ?? ''}`
              } else if (flatMatch) {
                resolvedHref = `/docs/${ver}/${flatMatch[1]}${flatMatch[2] ?? ''}`
              }
            }
            return (
              <Link
                href={resolvedHref}
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                sx={{
                  color: 'primary.main',
                  fontWeight: 500,
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  transition: 'border-color 0.2s',
                  '&:hover': {
                    borderBottomColor: 'primary.main',
                  },
                }}
              >
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
              return (
                <div className="mermaid-block" data-code={codeString}>
                  {isError ? (
                    <Box sx={{ color: '#ef4444', py: 2 }}>Mermaid render failed</Box>
                  ) : (
                    <Box
                      className="mermaid-svg-wrapper"
                      sx={{ width: '100%' }}
                      dangerouslySetInnerHTML={cachedSvg ? { __html: cachedSvg } : undefined}
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
                      const pngUrl = code ? await getMermaidPng(code) : null
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
          
          table: ({ children }) => (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                my: 3,
                borderRadius: 2,
                overflow: 'auto',
              }}
            >
              <Table size="small" sx={{ minWidth: 400 }}>{children}</Table>
            </TableContainer>
          ),
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
