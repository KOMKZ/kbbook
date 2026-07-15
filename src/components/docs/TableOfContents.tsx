import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'

/**
 * 页内目录 (Table of Contents)
 *
 * 设计要点：
 * - Sticky 固定在右侧
 * - 自动从 H2/H3 提取
 * - 当前滚动位置高亮
 * - 字号小于正文，对齐严谨
 */

interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
}

const TableOfContents = ({ content }: TableOfContentsProps) => {
  const { t } = useTranslation()
  useTheme() // 保持主题响应
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')

  // 从 Markdown 内容提取标题
  useEffect(() => {
    // 先移除围栏代码块，避免代码块内的 "###" 行被误识别为标题
    // （例如 binlog 格式示例中的 "### INSERT INTO ..."）
    const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '')
    const headingRegex = /^(#{2,3})\s+(.+)$/gm
    const items: TocItem[] = []
    const seen = new Set<string>()
    let match

    while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
      const level = match[1].length
      const text = match[2]
      let id = text
        .toLowerCase()
        .replace(/[^\w一-龥]+/g, '-')
        .replace(/^-|-$/g, '')

      // 去重：相同 id 的标题追加数字后缀
      if (seen.has(id)) {
        let counter = 2
        while (seen.has(`${id}-${counter}`)) counter++
        id = `${id}-${counter}`
      }
      seen.add(id)

      items.push({ id, text, level })
    }

    setTocItems(items)
  }, [content])

  // 滚动监听 - 更新激活项
  useEffect(() => {
    const handleScroll = () => {
      const headings = tocItems
        .map((item) => document.getElementById(item.id))
        .filter(Boolean) as HTMLElement[]

      // 找到当前可见的标题
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i]
        const rect = heading.getBoundingClientRect()
        if (rect.top <= 120) {
          setActiveId(tocItems[i].id)
          return
        }
      }

      if (headings.length > 0) {
        setActiveId(tocItems[0].id)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [tocItems])

  if (tocItems.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', mt: 4 }}>
        本文无二级/三级标题
      </Typography>
    )
  }

  return (
    <Box
      component="nav"
      aria-label="Table of contents"
      sx={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: 88,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
        // 自定义滚动条
        '&::-webkit-scrollbar': {
          width: 4,
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'transparent',
          borderRadius: 2,
        },
        '&:hover::-webkit-scrollbar-thumb': {
          bgcolor: 'divider',
        },
      }}
    >
      {/* 标题 */}
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          mb: 2,
          color: 'text.secondary',
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
        }}
      >
        {t('docs.toc')}
      </Typography>

      {/* 目录列表 */}
      <Box
        sx={{
          position: 'relative',
          // 左侧轨道线
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 1,
            bgcolor: 'divider',
          },
        }}
      >
        {tocItems.map((item) => {
          const isActive = activeId === item.id
          const isH3 = item.level === 3

          return (
            <Link
              key={item.id}
              href={`#${item.id}`}
              underline="none"
              sx={{
                display: 'block',
                position: 'relative',
                py: 0.75,
                pl: isH3 ? 3 : 2,
                pr: 1,
                fontSize: '0.8rem',
                lineHeight: 1.4,
                color: isActive ? 'primary.main' : 'text.secondary',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.15s ease',
                // 激活指示器
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 2,
                  height: isActive ? 16 : 0,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  transition: 'height 0.15s ease',
                },
                // Hover 效果
                '&:hover': {
                  color: isActive ? 'primary.main' : 'text.primary',
                },
                // 文本截断
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.text}
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}

export default TableOfContents
