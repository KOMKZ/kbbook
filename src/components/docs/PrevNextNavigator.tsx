import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import type { DocMeta } from '../../utils/docs'

interface PrevNextNavigatorProps {
  currentSlug: string
  docs: DocMeta[]
  seriesId: string
}

interface FlatArticle {
  slug: string
  title: string
}

/**
 * 扁平化 _meta.json 的所有文章(group items + flat items)到一个有序数组
 */
function flattenDocs(items: DocMeta[]): FlatArticle[] {
  const result: FlatArticle[] = []
  for (const item of items) {
    if (item.isGroup && item.items) {
      result.push(...flattenDocs(item.items))
    } else if (!item.isGroup) {
      result.push({ slug: item.slug, title: item.title })
    }
  }
  return result
}

/**
 * 文章底部自动 prev/next 导航
 *
 * 从 _meta.json 的平铺文章列表推导前后篇,不依赖 markdown 内的手动链接。
 * 手动写的 → 下一篇 链接依然在 markdown 正文中渲染,本组件作为兜底自动导航。
 */
const PrevNextNavigator = ({ currentSlug, docs, seriesId }: PrevNextNavigatorProps) => {
  const { prev, next } = useMemo(() => {
    const flat = flattenDocs(docs)
    const idx = flat.findIndex((a) => a.slug === currentSlug)
    if (idx === -1) return { prev: null, next: null }
    return {
      prev: idx > 0 ? flat[idx - 1] : null,
      next: idx < flat.length - 1 ? flat[idx + 1] : null,
    }
  }, [currentSlug, docs])

  if (!prev && !next) return null

  return (
    <Box
      sx={{
        maxWidth: 780,
        mx: 'auto',
        mt: 6,
        pt: 3,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {prev && (
          <Button
            component={RouterLink}
            to={`/docs/${seriesId}/${prev.slug}`}
            size="small"
            startIcon={<ArrowBackIcon />}
            sx={{
              textTransform: 'none',
              color: 'text.secondary',
              justifyContent: 'flex-start',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.65rem' }}>
                Previous
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 280,
                }}
              >
                {prev.title}
              </Typography>
            </Box>
          </Button>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
        {next && (
          <Button
            component={RouterLink}
            to={`/docs/${seriesId}/${next.slug}`}
            size="small"
            endIcon={<ArrowForwardIcon />}
            sx={{
              textTransform: 'none',
              color: 'text.secondary',
              justifyContent: 'flex-end',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <Box sx={{ textAlign: 'right', overflow: 'hidden' }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: '0.65rem' }}>
                Next
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 280,
                }}
              >
                {next.title}
              </Typography>
            </Box>
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default PrevNextNavigator
