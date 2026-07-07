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
import { useMediaQuery } from '@mui/material'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import { getPreferencesRepo } from '@/data/bridge.js'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WifiIcon from '@mui/icons-material/Wifi'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SettingsIcon from '@mui/icons-material/Settings'
import SyncIcon from '@mui/icons-material/Sync'
import InfoIcon from '@mui/icons-material/Info'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { useDocMode } from '../../contexts/DocModeContext'
import { useToolbarSizeCtx } from '../../contexts/ToolbarSizeContext'
import { listenSyncProgress, checkWebUpdate, getWebVersion, saveOssConfig as saveOssConfigNative, type SyncProgress } from '../../plugins/lz-portal-sync'
import { siteConfig } from '../../config/site'

declare const __BUILD_TIME__: string
declare const __VERSION_CODE__: string
declare const __OSS_ENDPOINT__: string
declare const __OSS_BUCKET__: string
declare const __OSS_PATH__: string
declare const __OSS_ACCESS_KEY_ID__: string
declare const __OSS_ACCESS_KEY_SECRET__: string
declare const __NETWORK_URL__: string
declare const __GIT_HASH__: string

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
  { id: 'oss',     label: 'OSS',    icon: <CloudSyncIcon fontSize="small" /> },
  { id: 'version', label: '版本',   icon: <InfoIcon fontSize="small" /> },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

const SIDEBAR_WIDTH = 180

// ============================================================
// OSS Config — defaults + localStorage persistence
// ============================================================

const OSS_DEFAULTS = {
  endpoint: (typeof __OSS_ENDPOINT__ !== 'undefined' && __OSS_ENDPOINT__) || 'https://oss-cn-shenzhen.aliyuncs.com',
  bucket: (typeof __OSS_BUCKET__ !== 'undefined' && __OSS_BUCKET__) || 'yogan-static',
  path: (typeof __OSS_PATH__ !== 'undefined' && __OSS_PATH__) || 'lz-learn-portal-sqllite-data',
  accessKeyId: (typeof __OSS_ACCESS_KEY_ID__ !== 'undefined' && __OSS_ACCESS_KEY_ID__) || '',
  accessKeySecret: (typeof __OSS_ACCESS_KEY_SECRET__ !== 'undefined' && __OSS_ACCESS_KEY_SECRET__) || '',
}

function loadOssConfig(): typeof OSS_DEFAULTS {
  return { ...OSS_DEFAULTS }
}

function saveOssConfig(cfg: typeof OSS_DEFAULTS) {
  try { getPreferencesRepo()?.set('kbbook-oss-config', cfg) } catch {}
}

// ============================================================
// SettingsPanel
// ============================================================

const SettingsPanel = () => {
  const [active, setActive] = useState<NavId>('general')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isNarrow = useMediaQuery('(max-width:600px)')
  const { networkUrl, syncStatus, syncing, updateNetworkUrl, triggerSync, syncResult } = useDocMode()
  const [urlInput, setUrlInput] = useState(networkUrl)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [webVersion, setWebVersion] = useState<string>('...')
  const [appVersion, setAppVersion] = useState<string>('...')

  // OSS config
  const [ossCfg, setOssCfg] = useState(loadOssConfig)
  const [ossSaved, setOssSaved] = useState(loadOssConfig) // last saved snapshot
  const [showSecret, setShowSecret] = useState(false)
  const isOssDirty = JSON.stringify(ossCfg) !== JSON.stringify(ossSaved)

  const updateOssField = (field: keyof typeof OSS_DEFAULTS, value: string) => {
    setOssCfg((prev) => ({ ...prev, [field]: value }))
  }

  const saveOssSettings = async () => {
    saveOssConfig(ossCfg)
    // Also persist to native SharedPreferences so Java plugin uses it
    await saveOssConfigNative(ossCfg).catch(() => {})
    setOssSaved({ ...ossCfg })
    setToast({ message: 'OSS 配置已保存（同步将使用新配置）', severity: 'success' })
  }

  const fillOssDefaults = () => {
    const cfg = { ...OSS_DEFAULTS }
    setOssCfg(cfg)
    setOssSaved(cfg)
    saveOssConfig(cfg)
    saveOssConfigNative(cfg).catch(() => {})
    setToast({ message: '已填入默认值并保存', severity: 'success' })
  }

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

  // On mount: restore OSS config from Repo
  useEffect(() => {
    getPreferencesRepo()?.get<typeof OSS_DEFAULTS>('kbbook-oss-config').then((saved) => {
      if (saved && saved.bucket) {
        const cfg = { ...OSS_DEFAULTS, ...saved }
        setOssCfg(cfg)
        setOssSaved(cfg)
      }
    }).catch(() => {})
  }, [])

  const isSyncing = syncing || (progress != null && progress.stage !== 'done')
  const progressPercent = progress?.percent ?? 0

  const handleUrlSave = async () => {
    await updateNetworkUrl(urlInput)
    setToast({ message: '网络地址已保存', severity: 'success' })
  }

  const handleDocSync = async () => {
    setProgress(null)
    try {
      await triggerSync(ossCfg)
      setToast({ message: '文档同步完成', severity: 'success' })
    } catch (e: any) {
      setProgress(null)
      setToast({ message: e?.message || '同步失败', severity: 'error' })
    }
  }

  // ---- per-nav content ----

  const renderContent = () => {
    switch (active) {
      case 'general':
        return (
          <>
            <ToolbarSizeSection />
            <Section title="外观" subtitle="主题、工具栏自动隐藏">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">工具栏无操作后自动隐藏（秒，0=不隐藏）：</Typography>
                <TextField size="small" type="number" sx={{ width: 70 }}
                  defaultValue="10"
                  onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); getPreferencesRepo()?.set('kbbook-toolbar-autohide', String(v)); setToast({message: `工具栏自动隐藏: ${v === 0 ? '关闭' : v + '秒'}`, severity:'success'}); }}
                  inputProps={{ min: 0, max: 300, step: 5 }}
                />
                <Typography variant="caption" color="text.secondary">秒</Typography>
              </Box>
            </Section>
          </>
        )

      case 'sync':
        return (
          <>
            {/* 内网同步 */}
            <Section
              title="内网同步"
              subtitle="从开发服务器拉取最新文档和数据"
              icon={<WifiIcon color="primary" />}
            >
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <TextField size="small" fullWidth value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://192.168.x.x:3004"
                />
                <Button variant="contained" onClick={handleUrlSave} size="small">保存</Button>
              </Box>
              <Button variant="outlined" size="small" onClick={handleDocSync} disabled={isSyncing}
                startIcon={isSyncing ? <CircularProgress size={14} /> : <SyncIcon fontSize="small" />}>
                {isSyncing ? '同步中...' : '从内网同步文档'}
              </Button>
            </Section>

            {/* OSS 文档同步 */}
            <Section
              title="OSS 文档同步"
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
                onClick={handleDocSync} disabled={isSyncing} fullWidth>
                {isSyncing ? '同步中...' : '立即同步'}
              </Button>
            </Section>
          </>
        )

      case 'oss':
        return (
          <>
            <Section title="OSS 配置" subtitle="对象存储连接参数（默认值来自系统配置，修改后优先使用你的值）"
              icon={<CloudSyncIcon color="primary" />}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField label="Endpoint" size="small" fullWidth
                  value={ossCfg.endpoint}
                  onChange={(e) => updateOssField('endpoint', e.target.value)}
                  placeholder="https://oss-cn-shenzhen.aliyuncs.com" />
                <TextField label="Bucket" size="small" fullWidth
                  value={ossCfg.bucket}
                  onChange={(e) => updateOssField('bucket', e.target.value)} />
                <TextField label="Path (Prefix)" size="small" fullWidth
                  value={ossCfg.path}
                  onChange={(e) => updateOssField('path', e.target.value)} />
                <TextField label="AccessKey ID" size="small" fullWidth
                  value={ossCfg.accessKeyId}
                  onChange={(e) => updateOssField('accessKeyId', e.target.value)} />
                <TextField label="AccessKey Secret" size="small" fullWidth
                  type={showSecret ? 'text' : 'password'}
                  value={ossCfg.accessKeySecret}
                  onChange={(e) => updateOssField('accessKeySecret', e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={() => setShowSecret(!showSecret)} edge="end">
                        {showSecret ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    ),
                  }} />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" size="small"
                  color={isOssDirty ? 'primary' : 'inherit'}
                  onClick={saveOssSettings}
                  disabled={!isOssDirty}>
                  保存配置{isOssDirty ? ' *' : ' ✓'}
                </Button>
                <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />}
                  onClick={fillOssDefaults}>
                  填入默认值
                </Button>
              </Box>
              {isOssDirty && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                  ⚠️ 配置已修改，请点击「保存配置」后再同步
                </Typography>
              )}
            </Section>

            {/* OSS data sync — pull only from portal/app */}
            <Section
              title="数据同步 (OSS)"
              subtitle="从 OSS 拉取最新文章数据（PC 端写入 → App 拉取同步）"
              icon={<CloudSyncIcon color="secondary" />}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" size="small"
                  onClick={async () => {
                    try {
                      const { getDriver, getPreferencesRepo } = await import('@/data/bridge.js')
                      const driver = getDriver()
                      const prefs = getPreferencesRepo()
                      if (!driver || !prefs) { setToast({ message: '存储未就绪', severity: 'error' }); return }
                      const ossCfg = await prefs.get<Record<string, string>>('kbbook-oss-config')
                      if (!ossCfg?.bucket) { setToast({ message: '请先在上方配置 OSS 参数', severity: 'error' }); return }
                      setToast({ message: '正在从 OSS 拉取...', severity: 'success' })
                      const { pullLatest, mergeFromOss } = await import('@/data/sync/oss.js')
                      const { exportDatabase, importDatabase } = await import('@/data/migration/exporter.js')
                      const result = await pullLatest({
                        bucket: ossCfg.bucket, region: ossCfg.region || 'oss-cn-hangzhou',
                        accessKeyId: ossCfg.accessKeyId, accessKeySecret: ossCfg.accessKeySecret,
                        path: ossCfg.path,
                      })
                      if (!result.success || !result.dump) {
                        setToast({ message: `拉取失败: ${result.error}`, severity: 'error' }); return
                      }
                      const localDump = await exportDatabase(driver)
                      const merged = mergeFromOss(localDump, result.dump)
                      await importDatabase(driver, merged)
                      setToast({ message: `同步完成 (${((result.sizeBytes || 0) / 1024).toFixed(1)} KB)`, severity: 'success' })
                    } catch (e) { setToast({ message: '同步异常: ' + (e as Error).message, severity: 'error' }) }
                  }}
                >从 OSS 拉取同步</Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                拉取最新文章数据（系列/目录/文章）。本地阅读记录和偏好设置不会覆盖。
              </Typography>
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
                <Box className="kv"><Typography variant="body2" color="text.secondary">构建时间</Typography><Typography variant="body2" fontWeight={600}>{typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev'}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">VersionCode</Typography><Typography variant="body2" fontWeight={600}>{typeof __VERSION_CODE__ !== 'undefined' ? __VERSION_CODE__ : 'dev'}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">Git Hash</Typography><Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__.slice(0,8) : 'unknown'}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">前端版本</Typography><Typography variant="body2" fontWeight={600}>{webVersion}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">App 版本</Typography><Typography variant="body2" fontWeight={600}>{appVersion}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">品牌</Typography><Typography variant="body2" fontWeight={600}>{siteConfig.name}</Typography></Box>
                <Box className="kv"><Typography variant="body2" color="text.secondary">模式</Typography><Typography variant="body2" fontWeight={600}>本机 SQLite</Typography></Box>
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
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden', pt: 'var(--header-height, 64px)', boxSizing: 'border-box' }}>
      {/* ---- Left sidebar — collapsible, responsive ---- */}
      <Box sx={{
        width: sidebarOpen ? (isNarrow ? '100%' : SIDEBAR_WIDTH) : 0,
        flexShrink: 0, borderRight: sidebarOpen ? 1 : 0, borderColor: 'divider',
        bgcolor: 'background.paper', overflow: sidebarOpen ? 'auto' : 'hidden',
        transition: 'width 0.25s',
        position: isNarrow && sidebarOpen ? 'absolute' : 'relative',
        zIndex: 10, height: '100%',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, pt: 1 }}>
          {sidebarOpen && (
            <Typography variant="subtitle2" sx={{ flex: 1, pl: 1, color: 'text.secondary', fontWeight: 600, letterSpacing: 0.5 }}>
              设置
            </Typography>
          )}
          <IconButton size="small" onClick={() => setSidebarOpen((v) => { const n = !v; getPreferencesRepo()?.set("kbbook-settings-sidebar", n ? "1" : "0"); return n })}>
            {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Box>
        {sidebarOpen && (
          <List dense disablePadding>
            {NAV_ITEMS.map((item) => (
              <ListItemButton key={item.id} selected={active === item.id}
                onClick={() => { setActive(item.id); if (isNarrow) { setSidebarOpen(false) } }}
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
        )}
      </Box>

      {/* Floating expand button when sidebar collapsed */}
      {!sidebarOpen && (
        <IconButton size="small" onClick={() => { setSidebarOpen(true) }}
          sx={{ position: 'fixed', top: 'calc(var(--header-height, 64px) + 8px)', left: 8, zIndex: 20,
            bgcolor: 'background.paper', boxShadow: 2,
            '&:hover': { bgcolor: 'action.hover' } }}>
          <MenuIcon fontSize="small" />
        </IconButton>
      )}

      {/* ---- Right content — scrolls independently ---- */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {renderContent()}
      </Box>

      {toastBar}
    </Box>
  )
}

export default SettingsPanel
