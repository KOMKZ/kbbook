import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { getSeries, type DocMeta } from '../../utils/docs'
import { siteConfig } from '../../config/site'
import type { Series } from '../../types/series'

interface BreadcrumbsProps {
  seriesId: string
  slug: string
  docs: DocMeta[]
}

/**
 * 找到 slug 所属的主题(group)和文章标题。
 * 支持平铺 slug 与嵌套 group/slug 两种形态。
 */
function locate(docs: DocMeta[], slug: string): { groupTitle?: string; articleTitle?: string } {
  for (const item of docs) {
    if (item.isGroup && item.items) {
      // 直接命中组内文章
      const inner = item.items.find((i) => i.slug === slug || i.slug.endsWith('/' + slug.split('/').pop()))
      if (inner) return { groupTitle: item.title, articleTitle: inner.title }
      // 嵌套二层(如 references/R01)
      for (const nest of item.items) {
        if (nest.isGroup && nest.items) {
          const deep = nest.items.find((i) => i.slug === slug)
          if (deep) return { groupTitle: item.title, articleTitle: deep.title }
        }
      }
    } else if (item.slug === slug) {
      return { articleTitle: item.title }
    }
  }
  return {}
}

/**
 * 文章页顶部面包屑:站点名 › 系列短名 › 主题 › 文章
 * 每一级可点击返回。
 */
const Breadcrumbs = ({ seriesId, slug, docs }: BreadcrumbsProps) => {
  const [series, setSeries] = useState<Series | undefined>()

  useEffect(() => {
    getSeries(seriesId).then(setSeries)
  }, [seriesId])

  const { groupTitle, articleTitle } = locate(docs, slug)

  const sep = (
    <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', mx: 0.25 }} />
  )

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '0.82rem',
        color: 'text.secondary',
        lineHeight: 1.8,
      }}
    >
      <Link component={RouterLink} to="/" underline="hover" color="inherit">
        {siteConfig.name}
      </Link>
      {sep}
      <Link component={RouterLink} to={`/docs/${seriesId}`} underline="hover" color="inherit">
        {series?.shortTitle || series?.title || seriesId}
      </Link>
      {groupTitle && (
        <>
          {sep}
          <Typography component="span" sx={{ fontSize: 'inherit', color: 'inherit' }}>
            {groupTitle}
          </Typography>
        </>
      )}
      {articleTitle && (
        <>
          {sep}
          <Typography
            component="span"
            sx={{ fontSize: 'inherit', color: 'text.primary', fontWeight: 600 }}
          >
            {articleTitle}
          </Typography>
        </>
      )}
    </Box>
  )
}

export default Breadcrumbs
