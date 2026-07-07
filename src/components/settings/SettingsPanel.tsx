/**
 * SettingsPanel — Left-nav + right-content layout
 *
 * Categories:
 *  - General   — Reading mode, toolbar size
 *  - Sync      — Network URL, OSS sync (works in any mode)
 *  - Version   — Full version info
 *
 * Left sidebar: fixed, independent scroll
 * Right content: scrolls independently
 */
import { useState, useEffect, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SettingsIcon from '@mui/icons-material/Settings'
import SyncIcon from '@mui/icons-material/Sync'
import InfoIcon from '@mui/icons-material/Info'
import { useDocMode } from '../../contexts/DocModeContext'
import { useToolbarSizeCtx } from '../../contexts/ToolbarSizeContext'
import { listenSyncProgress, checkWebUpdate, getWebVersion, type SyncProgress } from '../../plugins/lz-portal-sync'
import { siteConfig } from '../../config/site'

// ============================================================
// Section — reusable card
// ============================================================

function Section({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon?: ReactNode; children: ReactNode
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      {(title || icon) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: subtitle || children ? 1.5 : 0 }}>
          {icon}
          <Box>
            <Typography fontWeight={600}>{title}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Box>
      )}
      {children}
    </Paper>
  )
}

// ============================================================
// ToolbarSizeSection
// ============================================================

function ToolbarSizeSection() {
  const { toolbarSize, increaseToolbar, decreaseToolbar, resetToolbar } = useToolbarSizeCtx()
  const pct = Math.round(toolbarSize * 100)
  return (
    <Section title="工具栏大小" subtitle="调整所有页面浮动工具栏的按钮尺寸">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="缩小"><span><IconButton size="small" onClick={decreaseToolbar} disabled={toolbarSize <= 0.7}><RemoveIcon fontSize="small" /></IconButton></span></Tooltip>
        <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center', fontWeight: 600 }}>{pct}%</Typography>
        <Tooltip title="放大"><span><IconButton size="small" onClick={increaseToolbar} disabled={toolbarSize >= 1.8}><AddIcon fontSize="small" /></IconButton></span></Tooltip>
        <Button size="small" onClick={resetToolbar} disabled={toolbarSize === 1} sx={{ ml: 1 }}>重置</Button>
      </Box>
    </Section>
  )
}

// ============================================================
// Nav
// ============================================================

const NAV_ITEMS = [
  { id: 'general', label: '通用',   icon: <SettingsIcon fontSize="small" /> },
  { id: 'sync',    label: '同步',   icon: <SyncIcon fontSize="small" /> },
  { id: 'version', label: '版本',   icon: <InfoIcon fontSize="small" /> },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

const SIDEBAR_WIDTH = 180

// ============================================================
// SettingsPanel
// ============================================================

const SettingsPanel = () => {
  const [active, setActive] = useState<NavId>('general')
  const { mode, networkUrl, syncStatus, syncing, switchMode, updateNetworkUrl, triggerSync, syncResult } = useDocMode()
  const [urlInput, setUrlInput] = useState(networkUrl)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [webVersion, setWebVersion] = useState<string>('...')
  const [appVersion, setAppVersion] = useState<string>('...')

  useEffect(() => {
    const unlisten = listenSyncProgress((data) => setProgress(data))
    return () => { unlisten?.() }
  }, [])

  useEffect(() => {
    if (!syncing && progress?.stage === 'done') {
      const timer = setTimeout(() => setProgress(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [syncing, progress?.stage])

  useEffect(() => {
    getWebVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('unknown'))
    fetch('/version.json').then(r => r.json()).then(d => setWebVersion(d.version || '0.1.0')).catch(() => setWebVersion('0.1.0'))
  }, [])

  const isLocal = mode === 'local'
  const isSyncing = syncing || (progress != null && progress.stage !== 'done')
  const progressPercent = progress?.percent ?? 0

  const handleModeToggle = async () => {
    const newMode = isLocal ? 'network' : 'local'
    await switchMode(newMode)
    setToast({ message: `已切换至 ${newMode === 'local' ? '本地离线' : '网络直连'} 模式`, severity: 'success' })
  }

  const handleUrlSave = async () => {
    await updateNetworkUrl(urlInput)
    setToast({ message: '网络地址已保存', severity: 'success' })
  }

  const handleSync = async () => {
    setProgress(null)
    try {
      await triggerSync()
      setToast({ message: 'OSS 同步完成', severity: 'success' })
    } catch {
      setProgress(null)
      setToast({ message: 'OSS 同步失败，请检查网络连接', severity: 'error' })
    }
  }

  // ---- per-nav content ----

  const renderContent = () => {
    switch (active) {
      case 'general':
        return (
          <>
            <Section
              title="阅读模式"
              subtitle={isLocal ? '本地离线 — APK 内置 + OSS 同步' : '网络直连 — 连接开发服务器'}
              icon={isLocal ? <WifiOffIcon color="action" /> : <WifiIcon color="primary" />}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  当前: {isLocal ? '离线模式' : '在线模式'}
                </Typography>
                <Switch checked={!isLocal} onChange={handleModeToggle} />
              </Box>
            </Section>
            <ToolbarSizeSection />
            <Section title="外观" subtitle="主题、字体大小等（即将推出）">
              <Typography variant="body2" color="text.disabled">
                更多外观设置将在后续版本中添加。
              </Typography>
            </Section>
          </>
        )

      case 'sync':
        return (
          <>
            <Section
              title="服务器地址"
              subtitle="输入开发服务器地址"
              icon={<WifiIcon color="primary" />}
            >
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" fullWidth value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:3004"
                />
                <Button variant="contained" onClick={handleUrlSave} size="small">保存</Button>
              </Box>
            </Section>

            {/* OSS sync — always available regardless of mode */}
            <Section
              title="文档同步 (OSS)"
              subtitle="从阿里云 OSS 拉取最新文档到本地"
              icon={<CloudSyncIcon color="primary" />}
            >
              {syncStatus.lastSyncTime && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  上次: {syncStatus.lastSyncTime}
                  {syncStatus.fileCount > 0 && ` · ${syncStatus.fileCount} 文件`}
                  {syncStatus.syncVersion && ` · ${syncStatus.syncVersion}`}
                </Typography>
              )}

              {isSyncing && (
                <Box sx={{ mb: 1.5 }}>
                  <LinearProgress variant="determinate" value={progressPercent} sx={{ mb: 0.5, height: 6, borderRadius: 3 }} />
                  <Typography variant="caption" color="text.secondary">{progress?.detail ?? '准备中...'}</Typography>
                </Box>
              )}

              {!isSyncing && syncResult && (
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      {syncResult.skipped ? '已是最新版本' : '同步完成'}
                    </Typography>
                  </Box>
                  {!syncResult.skipped && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                      {syncResult.added > 0 && `+${syncResult.added} 新增 `}
                      {syncResult.updated > 0 && `~${syncResult.updated} 更新 `}
                      {syncResult.deleted > 0 && `-${syncResult.deleted} 删除 `}
                      {syncResult.added === 0 && syncResult.updated === 0 && syncResult.deleted === 0 && '无变化'}
                    </Typography>
                  )}
                </Box>
              )}

              <Button variant="outlined" startIcon={isSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
                onClick={handleSync} disabled={isSyncing} fullWidth>
                {isSyncing ? '同步中...' : '立即同步'}
              </Button>
            </Section>
          </>
        )

      case 'version':
        return (
          <>
            <Section title="App 更新" subtitle="检查并下载最新前端版本（重启生效）"
              icon={<SystemUpdateIcon color="primary" />}>
              <Button variant="outlined" startIcon={<SystemUpdateIcon />}
                onClick={async () => {
                  try {
                    setToast({ message: '正在检查更新...', severity: 'success' })
                    const result = await checkWebUpdate()
                    if (result.updateAvailable) {
                      setToast({ message: `发现新版本 ${result.version}，${result.fileCount} 文件已下载。重启 App 生效。`, severity: 'success' })
                    } else {
                      const current = await getWebVersion()
                      setToast({ message: `已是最新版本 (${current})`, severity: 'success' })
                    }
                  } catch { setToast({ message: '检查更新失败', severity: 'error' }) }
                }} fullWidth>检查更新</Button>
            </Section>

            <Section title="版本信息" subtitle="当前应用与前端版本详情"
              icon={<InfoIcon color="primary" />}>
              <Box sx={{ '& .kv': { display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: 1, borderColor: 'divider' } }}>
                <Box className="kv"><Typography variant="body2" color="text.secondary">前端版本</Typography><Typography variant="body2" fontWeight={600}>{webVersion}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">App 版本</Typography><Typography variant="body2" fontWeight={600}>{appVersion}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">品牌</Typography><Typography variant="body2" fontWeight={600}>{siteConfig.name}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">模式</Typography><Typography variant="body2" fontWeight={600}>{isLocal ? '本地离线' : '网络直连'}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">网络地址</Typography><Typography variant="body2" fontWeight={600}>{networkUrl}</Typography></Box>
                {syncStatus.lastSyncTime && (
                  <>
                    <Box className="kv"><Typography variant="body2" color="text.secondary">最近同步</Typography><Typography variant="body2" fontWeight={600}>{syncStatus.lastSyncTime}</Typography></Box>
                    <Box className="kv"><Typography variant="body2" color="text.secondary">同步文件数</Typography><Typography variant="body2" fontWeight={600}>{syncStatus.fileCount}</Typography></Box>
                    <Box className="kv"><Typography variant="body2" color="text.secondary">同步版本</Typography><Typography variant="body2" fontWeight={600}>{syncStatus.syncVersion || '-'}</Typography></Box>
                  </>
                )}
              </Box>
            </Section>
          </>
        )

      default:
        return null
    }
  }

  // ---- Toast ----
  const toastBar = (
    <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">{toast.message}</Alert> : undefined}
    </Snackbar>
  )

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - var(--header-height, 64px))', pt: 'var(--header-height, 64px)' }}>
      {/* ---- Left sidebar — FIXED, independent scroll ---- */}
      <Box sx={{
        width: SIDEBAR_WIDTH, flexShrink: 0,
        borderRight: 1, borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'auto',
        position: 'sticky', top: 0,
        height: 'calc(100vh - var(--header-height, 64px))',
      }}>
        <Typography variant="subtitle2" sx={{ px: 2, pt: 2.5, mb: 1, color: 'text.secondary', fontWeight: 600, letterSpacing: 0.5 }}>
          设置
        </Typography>
        <List dense disablePadding>
          {NAV_ITEMS.map((item) => (
            <ListItemButton key={item.id} selected={active === item.id}
              onClick={() => setActive(item.id)}
              sx={{ mx: 0.5, borderRadius: 1, mb: 0.25,
                '&.Mui-selected': { bgcolor: 'action.selected', '&:hover': { bgcolor: 'action.selected' } } }}>
              <ListItemIcon sx={{ minWidth: 36, color: active === item.id ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label}
                primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: active === item.id ? 600 : 400,
                  color: active === item.id ? 'primary.main' : 'text.primary' }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* ---- Right content — scrolls independently ---- */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {renderContent()}
      </Box>

      {toastBar}
    </Box>
  )
}

export default SettingsPanel
