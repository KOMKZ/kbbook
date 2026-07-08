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
import { useState, useEffect, useRef, type ReactNode } from 'react'
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
import BugReportIcon from '@mui/icons-material/BugReport'
import { getPreferencesRepo } from '@/data/bridge.js'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
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
import { listenSyncProgress, checkWebUpdate, getWebVersion, saveOssConfig as saveOssConfigNative, normalizeSyncResult, type SyncProgress, type SyncResult } from '../../plugins/lz-portal-sync'
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
  { id: 'debug',   label: '调试',   icon: <BugReportIcon fontSize="small" /> },
  { id: 'version', label: '版本',   icon: <InfoIcon fontSize="small" /> },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

const SIDEBAR_WIDTH = 180

interface DocSyncDisplayResult {
  added: number
  updated: number
  deleted: number
  fileCount: number
  time: string
  skipped?: boolean
  error?: string
}

function toDocSyncDisplayResult(result?: Partial<SyncResult> | null): DocSyncDisplayResult {
  const safe = normalizeSyncResult(result)
  return {
    added: safe.added,
    updated: safe.updated,
    deleted: safe.deleted,
    fileCount: safe.fileCount,
    skipped: safe.skipped,
    time: new Date().toLocaleTimeString(),
  }
}

async function writeDocSyncLog(level: 'info' | 'warn' | 'error', message: string, detail?: unknown) {
  try {
    const { debugLog } = await import('@/data/debug.js')
    debugLog[level]('doc-sync', message, detail)
    debugLog.flush()
  } catch {}
}

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

function regionFromEndpoint(ep: string): string {
  const m = ep.match(/\/\/(oss-[^.]+)\./)
  return m ? m[1] : 'oss-cn-shenzhen'
}

function loadOssConfig(): typeof OSS_DEFAULTS {
  const baked = { ...OSS_DEFAULTS }
  // Merge persisted config (user overrides baked-in build defaults)
  try {
    const stored = localStorage.getItem('lz-oss-config')
    if (stored) Object.assign(baked, JSON.parse(stored))
  } catch {}
  return baked
}

function saveOssConfig(cfg: typeof OSS_DEFAULTS) {
  try {
    localStorage.setItem('lz-oss-config', JSON.stringify(cfg))
    // Also write to SQLite prefs so pullLatest can read it
    getPreferencesRepo()?.set('kbbook-oss-config', cfg)
  } catch {}
}

// ============================================================
// Debug Panel
// ============================================================

function DebugPanel() {
  const [entries, setEntries] = useState<Array<{id:number;timestamp:number;level:string;module:string;message:string;detail?:string}>>([])
  const [filter, setFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(async () => {
      try {
        const { debugLog } = await import('@/data/debug.js')
        setEntries(debugLog.getRecent(200, filter || undefined))
      } catch {}
    }, 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, filter])

  useEffect(() => {
    // Initial load
    import('@/data/debug.js').then(m => setEntries(m.debugLog.getRecent(200)))
  }, [])

  const levelColor = (l: string) => l === 'error' ? 'error' : l === 'warn' ? '#ed6c02' : l === 'info' ? '#1976d2' : '#666'

  return (
    <>
      <Section title="调试日志" subtitle={`${entries.length} 条记录 · 自动刷新${autoRefresh ? '开启' : '关闭'}`} icon={<BugReportIcon color="primary" />}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField size="small" placeholder="过滤模块…" value={filter}
            onChange={e => setFilter(e.target.value)} sx={{ flex: 1 }} />
          <Button size="small" variant={autoRefresh ? 'contained' : 'outlined'}
            onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? '⏸ 暂停' : '▶ 刷新'}
          </Button>
          <Button size="small" onClick={async () => {
            const { debugLog } = await import('@/data/debug.js')
            debugLog.clear()
            setEntries([])
          }}>清空</Button>
          <Button size="small" onClick={async () => {
            const { debugLog } = await import('@/data/debug.js')
            const json = debugLog.export()
            // Copy to clipboard via navigator
            try {
              await navigator.clipboard.writeText(json)
            } catch {
              // Fallback: show in a dialog
              const blob = new Blob([json], {type:'application/json'})
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'kbbook-debug-log.json'
              a.click()
            }
          }}>导出</Button>
        </Box>
        <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto', p: 1, bgcolor: '#1e1e1e', fontFamily: 'monospace', fontSize: 11 }}>
          {entries.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>暂无日志</Typography>
          ) : (
            entries.map(e => (
              <Box key={e.id} sx={{ py: 0.25, borderBottom: '1px solid #333', lineHeight: 1.4 }}>
                <Typography component="span" sx={{ color: '#888', mr: 1 }}>
                  {new Date(e.timestamp).toLocaleTimeString()}
                </Typography>
                <Typography component="span" sx={{ color: levelColor(e.level), fontWeight: 'bold', mr: 1 }}>
                  {e.level.toUpperCase()}
                </Typography>
                <Typography component="span" sx={{ color: '#4ec9b0', mr: 1 }}>
                  [{e.module}]
                </Typography>
                <Typography component="span" sx={{ color: '#d4d4d4' }}>
                  {e.message}
                </Typography>
                {e.detail && (
                  <Typography component="span" sx={{ color: '#888', ml: 0.5 }}>
                    {e.detail.length > 200 ? e.detail.substring(0, 200) + '…' : e.detail}
                  </Typography>
                )}
              </Box>
            ))
          )}
        </Paper>
      </Section>
    </>
  )
}

// ============================================================
// SettingsPanel
// ============================================================

const SettingsPanel = () => {
  const [active, setActive] = useState<NavId>('general')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isNarrow = useMediaQuery('(max-width:600px)')
  const { networkUrl, syncStatus, syncing, triggerSync, syncResult } = useDocMode()
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [sqliteResult, setSqliteResult] = useState<{ tables: number; rows: number; sizeKB: string; time: string } | null>(null)
  const [docResult, setDocResult] = useState<DocSyncDisplayResult | null>(null)
  const [webVersion, setWebVersion] = useState<string>('...')
  const [appVersion, setAppVersion] = useState<string>('...')
  const docSyncInFlight = useRef(false)

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

  const handleDocSync = async () => {
    if (docSyncInFlight.current) {
      await writeDocSyncLog('warn', '忽略重复文档同步点击')
      return
    }
    docSyncInFlight.current = true
    setProgress(null)
    setDocResult(null)
    try {
      await writeDocSyncLog('info', '开始文档同步', { bucket: ossCfg.bucket, path: ossCfg.path, hasKey: !!ossCfg.accessKeyId })
      const result = toDocSyncDisplayResult(await triggerSync(ossCfg))
      setDocResult(result)
      await writeDocSyncLog('info', '文档同步完成', result)
      if (result.skipped) {
        setToast({ message: '已是最新版本', severity: 'success' })
      } else {
        setToast({ message: `同步完成: +${result.added} ~${result.updated} -${result.deleted}`, severity: 'success' })
      }
    } catch (e: any) {
      const message = e?.message || '同步失败'
      setProgress(null)
      setDocResult({ added: 0, updated: 0, deleted: 0, fileCount: 0, time: new Date().toLocaleTimeString(), error: message })
      setToast({ message, severity: 'error' })
      await writeDocSyncLog('error', '文档同步失败', { message, stack: e?.stack })
    } finally {
      docSyncInFlight.current = false
    }
  }

  // Keep the persistent result box in sync if another UI path triggers document sync.
  useEffect(() => {
    if (!syncing && syncResult) {
      setDocResult(toDocSyncDisplayResult(syncResult))
    }
  }, [syncing, syncResult])

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
            {/* OSS 同步（文档 + 数据） */}
            <Section
              title="OSS 同步"
              subtitle="从阿里云 OSS 拉取最新文档和数据（增量 MD5 diff）"
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
                      +{syncResult.added ?? 0} 新增 · ~{syncResult.updated ?? 0} 更新 · -{syncResult.deleted ?? 0} 删除
                    </Typography>
                  )}
                </Box>
              )}

              <Button variant="outlined" startIcon={isSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
                onClick={handleDocSync} disabled={isSyncing} fullWidth>
                {isSyncing ? '同步中...' : '立即同步文档'}
              </Button>
              {docResult && (
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: docResult.error ? 'error.light' : 'success.light', color: docResult.error ? 'error.contrastText' : 'success.contrastText' }}>
                  <Typography variant="body2" fontWeight="bold">
                    {docResult.error
                      ? `同步失败: ${docResult.error}`
                      : `${docResult.skipped ? '已是最新版本' : '同步完成'}: ${docResult.fileCount} 文件 · ${docResult.time}`}
                  </Typography>
                  {!docResult.error && (
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                      +{docResult.added} 新增 · ~{docResult.updated} 更新 · -{docResult.deleted} 删除
                    </Typography>
                  )}
                </Box>
              )}
              <Button variant="outlined" size="small" sx={{ mt: 1 }} fullWidth
                onClick={async () => {
                  const { debugLog } = await import('@/data/debug.js')
                  try {
                    const { getDriver, getPreferencesRepo } = await import('@/data/bridge.js')
                    const driver = getDriver()
                    const prefs = getPreferencesRepo()
                    if (!driver || !prefs) { setToast({ message: '存储未就绪', severity: 'error' }); debugLog.error('sync','driver or prefs not ready'); return }
                    const cfg = await prefs.get<Record<string, string>>('kbbook-oss-config')
                    debugLog.info('sync', 'SQLite sync: OSS config loaded', { bucket: cfg?.bucket, path: cfg?.path, hasKey: !!cfg?.accessKeyId, endpoint: cfg?.endpoint })
                    if (!cfg?.bucket) { setToast({ message: '请先配置 OSS 参数', severity: 'error' }); debugLog.error('sync','bucket missing from config'); return }
                    setToast({ message: '正在从 OSS 拉取数据...', severity: 'success' })
                    const { pullLatest, mergeFromOss } = await import('@/data/sync/oss.js')
                    const { exportDatabase, importDatabase } = await import('@/data/migration/exporter.js')
                    const region = regionFromEndpoint(cfg.endpoint || 'https://oss-cn-shenzhen.aliyuncs.com')
                    debugLog.info('sync', `pullLatest: bucket=${cfg.bucket} region=${region} path=${cfg.path}`)
                    const result = await pullLatest({
                      bucket: cfg.bucket,
                      region,
                      endpoint: cfg.endpoint,
                      accessKeyId: cfg.accessKeyId, accessKeySecret: cfg.accessKeySecret,
                      path: cfg.path,
                    })
                    if (!result.success || !result.dump) {
                      const errMsg = `拉取失败: ${result.error}`
                      setToast({ message: errMsg, severity: 'error' })
                      debugLog.error('sync', errMsg)
                      return
                    }
                    debugLog.info('sync', `pullLatest OK: ${result.sizeBytes} bytes, merging...`)
                    const localDump = await exportDatabase(driver)
                    const localRows = Object.values(localDump.tables).reduce((s,r)=>s+r.length,0)
                    debugLog.info('sync', `local dump: ${Object.keys(localDump.tables).length} tables, ${localRows} rows`)
                    const merged = mergeFromOss(localDump, result.dump)
                    await importDatabase(driver, merged)
                    const remoteTables = Object.keys(result.dump!.tables).length
                    const remoteRows = Object.values(result.dump!.tables).reduce((s,r)=>s+r.length,0)
                    const sizeKB = ((result.sizeBytes || 0) / 1024).toFixed(1)
                    const now = new Date().toLocaleTimeString()
                    setSqliteResult({ tables: remoteTables, rows: remoteRows, sizeKB, time: now })
                    // Clear docs cache so nav sidebar picks up new articles
                    const { clearDocsCache } = await import('@/utils/docs.js')
                    clearDocsCache()
                    setToast({ message: `同步完成: ${remoteTables} 表 ${remoteRows} 行 (${sizeKB} KB)`, severity: 'success' })
                    debugLog.info('sync', `SQLite sync done: ${remoteTables}t/${remoteRows}r, local was ${localRows}r`)
                    debugLog.flush()
                  } catch (e) {
                    const msg = '数据同步异常: ' + (e as Error).message
                    setToast({ message: msg, severity: 'error' })
                    debugLog.error('sync', msg, (e as Error).stack)
                    debugLog.flush()
                  }
                }}
              >同步 SQLite 数据</Button>
              {sqliteResult && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: 'success.light', borderRadius: 1, color: 'success.contrastText' }}>
                  <Typography variant="body2" fontWeight="bold">
                    上次同步: {sqliteResult.time} — {sqliteResult.tables} 表, {sqliteResult.rows} 行 ({sqliteResult.sizeKB} KB)
                  </Typography>
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                    提示: 结构数据已更新。切换页面或下拉刷新查看最新内容。
                  </Typography>
                </Box>
              )}
            </Section>

            {/* OSS 配置 */}
            <Section title="OSS 配置" subtitle="对象存储连接参数"
              icon={<CloudSyncIcon color="primary" />}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField label="Endpoint" size="small" fullWidth
                  value={ossCfg.endpoint}
                  onChange={(e) => updateOssField('endpoint', e.target.value)} />
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
          </>
        )


      case 'debug':
        return (
          <DebugPanel />
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
