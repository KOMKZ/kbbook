/**
 * SettingsPanel — 平板 App 设置面板
 *
 * 功能:
 *  - 模式切换 (本地离线 / 网络直连)
 *  - 网络模式 URL 配置
 *  - OSS 同步触发 + 进度 + 结果
 */
import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
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
import Chip from '@mui/material/Chip'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useDocMode } from '../../contexts/DocModeContext'
import { useToolbarSizeCtx } from '../../contexts/ToolbarSizeContext'
import { listenSyncProgress, checkWebUpdate, getWebVersion, type SyncProgress } from '../../plugins/lz-portal-sync'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

const SettingsPanel = () => {
  const { mode, networkUrl, syncStatus, syncing, switchMode, updateNetworkUrl, triggerSync, syncResult } =
    useDocMode()
  const [urlInput, setUrlInput] = useState(networkUrl)
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)
  // Sync progress state
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  // Listen for progress events
  useEffect(() => {
    const unlisten = listenSyncProgress((data) => {
      setProgress(data)
    })
    return () => {
      unlisten?.()
    }
  }, [])

  // Clear progress when sync finishes
  useEffect(() => {
    if (!syncing && progress?.stage === 'done') {
      // Keep "done" progress for 3 seconds then clear
      const timer = setTimeout(() => setProgress(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [syncing, progress?.stage])

  const handleModeToggle = async () => {
    const newMode = mode === 'local' ? 'network' : 'local'
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

  const isLocal = mode === 'local'

// ---- toolbar size section ----

const ToolbarSizeSection = () => {
  const { toolbarSize, increaseToolbar, decreaseToolbar, resetToolbar } = useToolbarSizeCtx()
  const pct = Math.round(toolbarSize * 100)
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
      <Typography fontWeight={600} gutterBottom>工具栏大小</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        调整所有页面浮动工具栏的按钮尺寸
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="缩小"><span><IconButton size="small" onClick={decreaseToolbar} disabled={toolbarSize <= 0.7}><RemoveIcon fontSize="small" /></IconButton></span></Tooltip>
        <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center', fontWeight: 600 }}>{pct}%</Typography>
        <Tooltip title="放大"><span><IconButton size="small" onClick={increaseToolbar} disabled={toolbarSize >= 1.8}><AddIcon fontSize="small" /></IconButton></span></Tooltip>
        <Button size="small" onClick={resetToolbar} disabled={toolbarSize === 1} sx={{ ml: 1 }}>重置</Button>
      </Box>
    </Paper>
  )
}
  const isSyncing = syncing || (progress != null && progress.stage !== 'done')
  const progressPercent = progress?.percent ?? 0

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        设置
      </Typography>

      {/* 模式切换 */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isLocal ? <WifiOffIcon color="action" /> : <WifiIcon color="primary" />}
            <Box>
              <Typography fontWeight={600}>阅读模式</Typography>
              <Typography variant="body2" color="text.secondary">
                {isLocal ? '本地离线 — APK 内置 + OSS 同步' : '网络直连 — 连接开发服务器'}
              </Typography>
            </Box>
          </Box>
          <Switch checked={!isLocal} onChange={handleModeToggle} />
        </Box>
        <Chip
          label={isLocal ? '离线' : '在线'}
          color={isLocal ? 'default' : 'primary'}
          size="small"
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* 网络 URL — 仅网络模式 */}
      {!isLocal && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          <Typography fontWeight={600} gutterBottom>服务器地址</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small" fullWidth value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:3004"
            />
            <Button variant="contained" onClick={handleUrlSave} size="small">保存</Button>
          </Box>
        </Paper>
      )}

      {/* OSS 同步 — 仅本地模式 */}
      {isLocal && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <CloudSyncIcon color="primary" />
            <Box>
              <Typography fontWeight={600}>文档同步 (OSS)</Typography>
              <Typography variant="body2" color="text.secondary">
                从阿里云 OSS 拉取最新文档
              </Typography>
            </Box>
          </Box>

          {/* Sync info */}
          {syncStatus.lastSyncTime && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              上次: {syncStatus.lastSyncTime}
              {syncStatus.fileCount > 0 && ` · ${syncStatus.fileCount} 文件`}
              {syncStatus.syncVersion && ` · ${syncStatus.syncVersion}`}
            </Typography>
          )}

          {/* Progress bar */}
          {isSyncing && (
            <Box sx={{ mb: 1.5 }}>
              <LinearProgress variant="determinate" value={progressPercent} sx={{ mb: 0.5, height: 6, borderRadius: 3 }} />
              <Typography variant="caption" color="text.secondary">
                {progress?.detail ?? '准备中...'}
              </Typography>
            </Box>
          )}

          {/* Done indicator */}
          {!isSyncing && syncResult && (
            <Box sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  {syncResult.skipped
                    ? '已是最新版本'
                    : '同步完成'}
                </Typography>
              </Box>
              {!syncResult.skipped && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3.5 }}>
                  {syncResult.added > 0 && `+${syncResult.added} 新增 `}
                  {syncResult.updated > 0 && `~${syncResult.updated} 更新 `}
                  {syncResult.deleted > 0 && `-${syncResult.deleted} 删除 `}
                  {syncResult.added === 0 && syncResult.updated === 0 && syncResult.deleted === 0
                    && '无变化'}
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
            disabled={isSyncing}
            fullWidth
          >
            {isSyncing ? '同步中...' : '立即同步'}
          </Button>
        </Paper>
      )}

      {/* 工具栏大小 */}
      <ToolbarSizeSection />

      {/* App OTA 更新 */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <SystemUpdateIcon color="primary" />
          <Box>
            <Typography fontWeight={600}>App 更新</Typography>
            <Typography variant="body2" color="text.secondary">
              检查并下载最新前端版本（重启生效）
            </Typography>
          </Box>
        </Box>
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
      </Paper>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.disabled">
        LZ Portal · v1.0
      </Typography>

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
