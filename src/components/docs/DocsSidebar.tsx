import { useState, useMemo, useCallback } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { useTheme } from '@mui/material/styles'
import { resolveSlugFromParams } from '../../utils/docs'
import { siteConfig } from '../../config/site'

interface DocMeta {
  slug: string
  title: string
  order: number
  isGroup?: boolean
  items?: DocMeta[]
}

interface VersionInfo {
  version: string
  label: string
  path: string
  isLatest: boolean
}

interface DocsSidebarProps {
  versions: VersionInfo[]
  currentVersion: string
  docs: DocMeta[]
  seriesId?: string
}

const DocsSidebar = ({ versions, currentVersion, docs, seriesId }: DocsSidebarProps) => {
  // 多系列路由:用 seriesId 构建链接,兼容旧 version-only 路径
  const navPrefix = seriesId ? `/docs/${seriesId}` : `/docs/${currentVersion}`
  const params = useParams()
  // 统一 slug 解析(支持嵌套 group/slug URL),禁止独立拼接,见 utils/docs.ts:resolveSlugFromParams
  const slug = resolveSlugFromParams(params)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const theme = useTheme()

  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => a.order - b.order),
    [docs],
  )

  const groupSlugs = useMemo(
    () => sortedDocs.filter((d) => d.isGroup).map((d) => d.slug),
    [sortedDocs],
  )

  // 默认全部展开
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groupSlugs),
  )

  const toggleGroup = useCallback((groupSlug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(groupSlug)) {
        next.delete(groupSlug)
      } else {
        next.add(groupSlug)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(groupSlugs))
  }, [groupSlugs])

  const collapseAll = useCallback(() => {
    // 保留包含当前激活文档的分组
    const activeGroup = sortedDocs.find(
      (d) => d.isGroup && d.items?.some((item) => item.slug === slug),
    )
    setExpanded(activeGroup ? new Set([activeGroup.slug]) : new Set())
  }, [sortedDocs, slug, groupSlugs])

  const allExpanded = expanded.size === groupSlugs.length

  const handleVersionChange = (event: SelectChangeEvent) => {
    const newVersion = event.target.value
    navigate(`/docs/${newVersion}/${slug || docs[0]?.slug || ''}`)
  }

  const currentVersionInfo = versions.find((v) => v.path === currentVersion)

  // 确保包含当前文档的分组始终展开（支持 L1 group 与 L2 子项）
  const activeGroupSlug = useMemo(() => {
    const g = sortedDocs.find(
      (d) =>
        d.isGroup &&
        d.items?.some(
          (item) =>
            item.slug === slug ||
            (item.isGroup && item.items?.some((sub) => sub.slug === slug)),
        ),
    )
    return g?.slug
  }, [sortedDocs, slug])

  // L1 主篇本身也是 group 时,如果当前 slug 在其 level-2 items 中,则也要展开
  const activeL1Slug = useMemo(() => {
    for (const d of sortedDocs) {
      if (!d.isGroup || !d.items) continue
      for (const item of d.items) {
        if (item.isGroup && item.items?.some((s) => s.slug === slug)) {
          return item.slug
        }
      }
    }
    return undefined
  }, [sortedDocs, slug])

  const isGroupExpanded = (groupSlug: string) =>
    expanded.has(groupSlug) || groupSlug === activeGroupSlug || groupSlug === activeL1Slug

  return (
    <Box
      component="aside"
      sx={{
        width: 280,
        flexShrink: 0,
        height: 'calc(100vh - var(--header-height))',
        position: 'sticky',
        top: 'var(--header-height)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      {/* 版本选择器 + 展开/收缩按钮 */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {t('docs.version')}
          </Typography>
          <Tooltip title={allExpanded ? t('docs.collapseAll', 'Collapse All') : t('docs.expandAll', 'Expand All')}>
            <IconButton
              size="small"
              onClick={allExpanded ? collapseAll : expandAll}
              sx={{
                width: 28,
                height: 28,
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {allExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <FormControl fullWidth size="small">
          <Select
            value={currentVersion}
            onChange={handleVersionChange}
            sx={{
              bgcolor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'grey.50',
              '& .MuiSelect-select': {
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              },
            }}
            renderValue={() => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {currentVersionInfo?.label || currentVersion}
                </Typography>
                {currentVersionInfo?.isLatest && (
                  <Chip
                    label="Latest"
                    size="small"
                    color="primary"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
                  />
                )}
              </Box>
            )}
          >
            {versions.map((v) => (
              <MenuItem
                key={v.version}
                value={v.path}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Typography variant="body2">{v.label}</Typography>
                {v.isLatest && (
                  <Chip
                    label="Latest"
                    size="small"
                    color="primary"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* 文档导航区域 */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 1,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        <List dense disablePadding>
          {sortedDocs.map((doc) => {
            if (doc.isGroup && doc.items) {
              const open = isGroupExpanded(doc.slug)
              const sortedItems = [...doc.items].sort((a, b) => a.order - b.order)
              const hasActive = doc.items.some((item) => item.slug === slug)

              return (
                <Box key={doc.slug}>
                  {/* 可点击的分组标题 */}
                  <ListItemButton
                    onClick={() => toggleGroup(doc.slug)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      mt: 0.5,
                      borderRadius: 0,
                      '&:hover': {
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'grey.50',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        gap: 0.5,
                      }}
                    >
                      {open ? (
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 16,
                            color: hasActive ? 'primary.main' : 'text.secondary',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      ) : (
                        <ChevronRightIcon
                          sx={{
                            fontSize: 16,
                            color: hasActive ? 'primary.main' : 'text.secondary',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      )}
                      <Typography
                        variant="overline"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          color: hasActive ? 'primary.main' : 'text.secondary',
                          lineHeight: 1.5,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {doc.title}
                      </Typography>
                    </Box>
                  </ListItemButton>

                  {/* 可折叠的子文档列表(支持 L1 主篇本身是子组 → 渲染 level-2 子树) */}
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    {sortedItems.map((item) => {
                      const isActive = slug === item.slug
                      const isL1Group = item.isGroup && item.items && item.items.length > 0
                      const l1Open = isGroupExpanded(item.slug)
                      const l1HasActiveChild = isL1Group && item.items!.some((sub) => sub.slug === slug)

                      // L1 主篇本身是 group:渲染可点击主篇 + 独立展开按钮 + level-2 子树
                      if (isL1Group) {
                        const sortedL2 = [...item.items!].sort((a, b) => a.order - b.order)
                        return (
                          <Box key={item.slug}>
                            <ListItem disablePadding sx={{ px: 1 }}>
                              <ListItemButton
                                component={RouterLink}
                                to={`${navPrefix}/${item.slug}`}
                                selected={isActive}
                                sx={{
                                  borderRadius: 1.5,
                                  py: 0.6,
                                  pl: 1,
                                  pr: 0.5,
                                  ml: 2.5,
                                  ...(isActive && {
                                    position: 'relative',
                                    '&::before': {
                                      content: '""',
                                      position: 'absolute',
                                      left: 0,
                                      top: '20%',
                                      bottom: '20%',
                                      width: 3,
                                      borderRadius: 2,
                                      bgcolor: 'primary.main',
                                    },
                                  }),
                                  '&:hover': {
                                    bgcolor:
                                      theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'grey.100',
                                  },
                                }}
                              >
                                <Box
                                  component="span"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleGroup(item.slug)
                                  }}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    pr: 0.5,
                                    cursor: 'pointer',
                                    color: l1HasActiveChild ? 'primary.main' : 'text.secondary',
                                  }}
                                >
                                  {l1Open ? (
                                    <ExpandMoreIcon sx={{ fontSize: 14 }} />
                                  ) : (
                                    <ChevronRightIcon sx={{ fontSize: 14 }} />
                                  )}
                                </Box>
                                <ListItemText
                                  primary={item.title}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    fontWeight: isActive || l1HasActiveChild ? 600 : 400,
                                    color: isActive ? 'primary.main' : 'text.primary',
                                    fontSize: '0.82rem',
                                    sx: { transition: 'color 0.15s ease' },
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                            <Collapse in={l1Open} timeout="auto" unmountOnExit>
                              {sortedL2.map((sub) => {
                                const subActive = slug === sub.slug
                                return (
                                  <ListItem key={sub.slug} disablePadding sx={{ px: 1 }}>
                                    <ListItemButton
                                      component={RouterLink}
                                      to={`${navPrefix}/${sub.slug}`}
                                      selected={subActive}
                                      sx={{
                                        borderRadius: 1.5,
                                        py: 0.5,
                                        px: 1.5,
                                        ml: 5,
                                        ...(subActive && {
                                          position: 'relative',
                                          '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            left: 0,
                                            top: '20%',
                                            bottom: '20%',
                                            width: 3,
                                            borderRadius: 2,
                                            bgcolor: 'primary.main',
                                          },
                                        }),
                                        '&:hover': {
                                          bgcolor:
                                            theme.palette.mode === 'dark'
                                              ? 'rgba(255, 255, 255, 0.05)'
                                              : 'grey.100',
                                        },
                                      }}
                                    >
                                      <ListItemText
                                        primary={sub.title}
                                        primaryTypographyProps={{
                                          variant: 'body2',
                                          fontWeight: subActive ? 600 : 400,
                                          color: subActive ? 'primary.main' : 'text.secondary',
                                          fontSize: '0.76rem',
                                          sx: { transition: 'color 0.15s ease' },
                                        }}
                                      />
                                    </ListItemButton>
                                  </ListItem>
                                )
                              })}
                            </Collapse>
                          </Box>
                        )
                      }

                      // L1 普通文章
                      return (
                        <ListItem key={item.slug} disablePadding sx={{ px: 1 }}>
                          <ListItemButton
                            component={RouterLink}
                            to={`${navPrefix}/${item.slug}`}
                            selected={isActive}
                            sx={{
                              borderRadius: 1.5,
                              py: 0.6,
                              px: 1.5,
                              ml: 2.5,
                              ...(isActive && {
                                position: 'relative',
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  left: 0,
                                  top: '20%',
                                  bottom: '20%',
                                  width: 3,
                                  borderRadius: 2,
                                  bgcolor: 'primary.main',
                                },
                              }),
                              '&:hover': {
                                bgcolor:
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : 'grey.100',
                              },
                            }}
                          >
                            <ListItemText
                              primary={item.title}
                              primaryTypographyProps={{
                                variant: 'body2',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'primary.main' : 'text.primary',
                                fontSize: '0.82rem',
                                sx: { transition: 'color 0.15s ease' },
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      )
                    })}
                  </Collapse>
                </Box>
              )
            }

            // 普通文档项（非分组）
            const isActive = slug === doc.slug
            return (
              <ListItem key={doc.slug} disablePadding sx={{ px: 1 }}>
                <ListItemButton
                  component={RouterLink}
                  to={`${navPrefix}/${doc.slug}`}
                  selected={isActive}
                  sx={{
                    borderRadius: 1.5,
                    py: 0.75,
                    px: 1.5,
                    ...(isActive && {
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        bottom: '20%',
                        width: 3,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                      },
                    }),
                    '&:hover': {
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'grey.100',
                    },
                  }}
                >
                  <ListItemText
                    primary={doc.title}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'primary.main' : 'text.primary',
                      sx: { transition: 'color 0.15s ease' },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      </Box>

      {/* 底部信息 */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.02)'
              : 'grey.50',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {siteConfig.name} Docs
        </Typography>
      </Box>
    </Box>
  )
}

export default DocsSidebar
