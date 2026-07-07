/**
 * SettingsPanel — Tab-based settings panel
 *
 * Tabs:
 *  - General   — Reading mode, toolbar size, appearance
 *  - Sync      — Network URL, OSS sync
 *  - About     — App update, version info
 *
 * Extending: add a new TabPanel + new <Tab label="..."> in the Tabs bar.
 */
import { useState, useEffect, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
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
// TabPanel — reusable tab content wrapper
// ============================================================

function TabPanel({ children, value, index }: { children: ReactNode; value: number; index: number }) {
  if (value !== index) return null
  return <Box sx={{ pt: 2.5 }}>{children}</Box>
}

// ============================================================
// Section wrapper — consistent card style per setting group
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
// ToolbarSizeSection — standalone to use its own hook
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
// SettingsPanel
// ============================================================

const TABS = [
  { label: '通用', icon: <SettingsIcon fontSize="small" /> },
  { label: '同步', icon: <SyncIcon fontSize="small" /> },
  { label: '关于', icon: <InfoIcon fontSize="small" /> },
]

const SettingsPanel = () => {
  const [tab, setTab] = useState(0)
  const { mode, networkUrl, syncStatus, syncing, switchMode, updateNetworkUrl, triggerSync, syncResult } =
    useDocMode()
  const [urlInput, setUrlInput] = useState(networkUrl)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)

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

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        设置
      </Typography>

      {/* ---- Tab bar ---- */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}
      >
        {TABS.map((t, i) => (
          <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} sx={{ textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>

      {/* ================================================ */}
      {/* Tab 0: General                                    */}
      {/* ================================================ */}
      <TabPanel value={tab} index={0}>
        {/* Reading mode */}
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

        {/* Toolbar size */}
        <ToolbarSizeSection />

        {/* Placeholder for future general settings */}
        <Section title="外观" subtitle="主题、字体大小等（即将推出）">
          <Typography variant="body2" color="text.disabled">
            更多外观设置将在后续版本中添加。
          </Typography>
        </Section>
      </TabPanel>

      {/* ================================================ */}
      {/* Tab 1: Sync                                       */}
      {/* ================================================ */}
      <TabPanel value={tab} index={1}>
        {/* Network URL */}
        <Section
          title="服务器地址"
          subtitle={isLocal ? '切换到在线模式后可配置' : '输入开发服务器地址'}
          icon={<WifiIcon color={isLocal ? 'disabled' : 'primary'} />}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small" fullWidth value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:3004"
              disabled={isLocal}
            />
            <Button variant="contained" onClick={handleUrlSave} size="small" disabled={isLocal}>保存</Button>
          </Box>
        </Section>

        {/* OSS Sync */}
        <Section
          title="文档同步 (OSS)"
          subtitle="从阿里云 OSS 拉取最新文档到本地"
          icon={<CloudSyncIcon color={isLocal ? 'primary' : 'disabled'} />}
        >
          {!isLocal && (
            <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
              请先在「通用」标签切换到离线模式
            </Typography>
          )}

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
                  {' · ' + syncResult.fileCount + ' 文件总计'}
                  {syncResult.totalSize > 0 && ' · ' + (syncResult.totalSize / 1024).toFixed(0) + ' KB'}
                </Typography>
              )}
            </Box>
          )}

          <Button
            variant="outlined"
            startIcon={isSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
            onClick={handleSync}
            disabled={isSyncing || !isLocal}
            fullWidth
          >
            {isSyncing ? '同步中...' : '立即同步'}
          </Button>
        </Section>
      </TabPanel>

      {/* ================================================ */}
      {/* Tab 2: About                                      */}
      {/* ================================================ */}
      <TabPanel value={tab} index={2}>
        <Section
          title="App 更新"
          subtitle="检查并下载最新前端版本（重启生效）"
          icon={<SystemUpdateIcon color="primary" />}
        >
          <Button
            variant="outlined"
            startIcon={<SystemUpdateIcon />}
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
              } catch {
                setToast({ message: '检查更新失败', severity: 'error' })
              }
            }}
            fullWidth
          >
            检查更新
          </Button>
        </Section>

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.disabled">
          {siteConfig.name} · v1.0
        </Typography>
      </TabPanel>

      {/* ---- Toast ---- */}
      <Snackbar
        open={!!toast} autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

export default SettingsPanel
