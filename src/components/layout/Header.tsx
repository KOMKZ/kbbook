import { useEffect, useState, useRef } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Chip from '@mui/material/Chip'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import GitHubIcon from '@mui/icons-material/GitHub'
import ThemeSwitcher from '../common/ThemeSwitcher'
import SearchDialog from '../docs/SearchDialog'
import { loadSeriesRegistry } from '../../utils/docs'
import { siteConfig } from '../../config/site'
import type { Series } from '../../types/series'

/**
 * 顶部导航 —— 多系列门户极简版
 *
 * 结构: [Logo] · [系列 picker 下拉] · ...flex... · [GitHub] [暗色切换]
 * 不再有"学习路线/路线图/文档"独立 nav 项,这些已并入 系列详情页 内部入口。
 */

const Header = () => {
  const theme = useTheme()
  const navigate = useNavigate()
  const { series: currentSeriesId } = useParams<{ series?: string }>()
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [defaultSeriesId, setDefaultSeriesId] = useState<string>('llm')
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const appBarRef = useRef<HTMLElement>(null)

  // 将 AppBar 实际高度写入 CSS 变量，供 DocsSidebar / DocsPage / MarkdownRenderer 消费
  useEffect(() => {
    const el = appBarRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--header-height', `${h}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    loadSeriesRegistry().then((reg) => {
      setSeriesList(reg.series)
      setDefaultSeriesId(reg.defaultSeries)
    })
  }, [])

  const activeId = currentSeriesId || defaultSeriesId
  const activeSeries = seriesList.find((s) => s.id === activeId)
  const seriesLabel = activeSeries?.shortTitle || activeSeries?.title || '系列'

  const handleSelectSeries = (id: string, enabled: boolean) => {
    setAnchor(null)
    if (enabled) navigate(`/docs/${id}`)
  }

  return (
    <AppBar position="fixed" elevation={0} ref={appBarRef}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ height: { xs: 56, sm: 64 }, gap: { xs: 0.5, sm: 1 } }}>
          {/* Logo */}
          <Box
            component={RouterLink}
            to="/"
            sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', mr: 2 }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.25,
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>{siteConfig.logo.text}</Typography>
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.05rem', display: { xs: 'none', sm: 'block' } }}
            >
              {siteConfig.name}
            </Typography>
          </Box>

          {/* 系列 picker */}
          <Button
            size="small"
            onClick={(e) => setAnchor(e.currentTarget)}
            endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.88rem',
              textTransform: 'none',
              px: 1.25,
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            {seriesLabel}
          </Button>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            {seriesList.map((s) => (
              <MenuItem
                key={s.id}
                selected={s.id === activeId}
                disabled={!s.enabled}
                onClick={() => handleSelectSeries(s.id, s.enabled)}
                sx={{ minWidth: 240 }}
              >
                <ListItemIcon sx={{ fontSize: '1.2rem' }}>{s.icon || '📚'}</ListItemIcon>
                <ListItemText
                  primary={s.title}
                  secondary={s.tagline}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
                {!s.enabled && (
                  <Chip label="敬请期待" size="small" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                )}
              </MenuItem>
            ))}
          </Menu>

          {/* 占位伸缩 */}
          <Box sx={{ flex: 1 }} />

          {/* 右侧:搜索 + 设置 + GitHub + 暗色 */}
          <IconButton
            onClick={() => setSearchOpen(true)}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
          <IconButton
            component={RouterLink}
            to="/settings"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          <Button
            component="a"
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<GitHubIcon sx={{ fontSize: 18 }} />}
            sx={{
              px: 1.5,
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.88rem',
              textTransform: 'none',
              display: { xs: 'none', sm: 'inline-flex' },
              '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
            }}
          >
            GitHub
          </Button>
          <ThemeSwitcher />
        </Toolbar>
      </Container>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </AppBar>
  )
}

export default Header
