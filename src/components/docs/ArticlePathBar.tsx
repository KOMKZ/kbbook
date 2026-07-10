import { Fragment, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { getSeries, type DocMeta } from '../../utils/docs'
import { siteConfig } from '../../config/site'
import { locate } from './Breadcrumbs'
import type { Series } from '../../types/series'

interface Props {
  seriesId: string
  slug: string
  docs: DocMeta[]
  /** 左侧目录是否折叠——决定固定路径栏的左边界,与主内容列对齐 */
  sidebarCollapsed?: boolean
}

/**
 * 文章详情常驻路径栏:站点 › 系列 › 主题 › 文章标题
 * 纯文本(不可点)、小字、可换行、常驻于 header 下方,不随滚动消失。
 *
 * 用 position:fixed 而非 sticky —— 本站 body 因 overflow-x:hidden 令 overflow-y 计算成
 * auto,意外成为滚动容器,会把 sticky 锚死在不滚动的 body 上而失效(实测 sticky 不吸顶、
 * fixed 正常)。fixed 定位到主内容列(避开左目录/右 TOC),再用等高占位撑开被覆盖的内容。
 */
const ArticlePathBar = ({ seriesId, slug, docs, sidebarCollapsed = false }: Props) => {
  const [series, setSeries] = useState<Series | undefined>()
  const barRef = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(0)

  useEffect(() => {
    getSeries(seriesId).then(setSeries)
  }, [seriesId])

  const { groupTitle, articleTitle } = locate(docs, slug)
  const seriesTitle = series?.shortTitle || series?.title || seriesId
  const segments = [siteConfig.name, seriesTitle, groupTitle, articleTitle].filter(Boolean) as string[]
  const pathKey = segments.join(' › ')

  // fixed 脱离文档流:用 ResizeObserver 测其真实(可换行)高度,渲染等高占位撑开内容顶部
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const measure = () => setBarHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pathKey])

  return (
    <>
      <Box
        ref={barRef}
        sx={{
          position: 'fixed',
          top: 'var(--header-height, 64px)',
          left: { xs: 0, md: sidebarCollapsed ? '40px' : '280px' },
          right: { xs: 0, xl: '240px' },
          zIndex: 90,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            maxWidth: 780,
            mx: 'auto',
            px: { xs: 3, sm: 4, md: 6 },
            py: 0.6,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 0.5,
            rowGap: 0.25,
            fontSize: '0.7rem',
            lineHeight: 1.5,
            color: 'text.secondary',
          }}
        >
          {segments.map((seg, i) => {
            const isLast = i === segments.length - 1
            return (
              <Fragment key={i}>
                {i > 0 && (
                  <Box component="span" sx={{ color: 'text.disabled', userSelect: 'none' }}>
                    ›
                  </Box>
                )}
                <Box
                  component="span"
                  sx={{
                    color: isLast ? 'text.primary' : 'inherit',
                    fontWeight: isLast ? 600 : 400,
                    wordBreak: 'break-word',
                  }}
                >
                  {seg}
                </Box>
              </Fragment>
            )
          })}
        </Box>
      </Box>
      {/* 等高占位:撑开被 fixed 路径栏覆盖的内容顶部(随换行高度自适应) */}
      <Box aria-hidden sx={{ height: `${barHeight}px` }} />
    </>
  )
}

export default ArticlePathBar
