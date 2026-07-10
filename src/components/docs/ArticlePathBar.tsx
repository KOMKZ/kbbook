import { Fragment, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { getSeries, type DocMeta } from '../../utils/docs'
import { siteConfig } from '../../config/site'
import { locate } from './Breadcrumbs'
import type { Series } from '../../types/series'

interface Props {
  seriesId: string
  slug: string
  docs: DocMeta[]
}

/**
 * 文章详情常驻路径栏:站点 › 系列 › 主题 › 文章标题
 * 纯文本(不可点)、小字、可换行、sticky 常驻于 header 下方,不随滚动消失。
 */
const ArticlePathBar = ({ seriesId, slug, docs }: Props) => {
  const [series, setSeries] = useState<Series | undefined>()

  useEffect(() => {
    getSeries(seriesId).then(setSeries)
  }, [seriesId])

  const { groupTitle, articleTitle } = locate(docs, slug)
  const seriesTitle = series?.shortTitle || series?.title || seriesId
  const segments = [siteConfig.name, seriesTitle, groupTitle, articleTitle].filter(Boolean) as string[]

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 'var(--header-height, 64px)',
        zIndex: 10,
        maxWidth: 780,
        mx: 'auto',
        mb: 2,
        py: 0.6,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
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
  )
}

export default ArticlePathBar
