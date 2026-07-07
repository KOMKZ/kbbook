import { useEffect } from 'react'
import { Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import DocsPage from './pages/docs/DocsPage'
import SeriesDetailPage from './pages/series/SeriesDetailPage'
import SettingsPage from './pages/SettingsPage'
import { DocModeProvider } from './contexts/DocModeContext'
import { ToolbarSizeProvider } from './contexts/ToolbarSizeContext'
import { StorageProvider } from './contexts/StorageContext'

/**
 * /docs/:series/*   — 文档路由，用 splat 捕获任意深度的 slug。
 *   特殊处理：如果 series 以 'v' 开头 → 旧版本路径，永久重定向到 /docs/llm/...
 */
const SeriesOrLegacyDoc = () => {
  const params = useParams<{ series: string; '*'?: string }>()
  const series = params.series
  const rest = params['*'] || ''

  if (series && series.startsWith('v')) {
    return <Navigate to={`/docs/llm${rest ? '/' + rest : ''}`} replace />
  }
  return <DocsPage />
}

/**
 * Android 返回按钮处理：在 WebView 里拦截返回键，先走浏览器历史回退；
 * 无历史可退时才退出 app。
 */
function useBackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    let handler: { remove: () => void } | null = null

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || (window.history?.length ?? 1) > 1) {
        navigate(-1)
      } else {
        CapacitorApp.exitApp()
      }
    }).then((h) => {
      if (!cancelled) handler = h
    })

    return () => {
      cancelled = true
      handler?.remove()
    }
  }, [navigate, location])
}

function App() {
  useBackButton()

  return (
    <StorageProvider>
    <ToolbarSizeProvider>
    <DocModeProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
        </Route>

        {/* 多系列文档结构 */}
        <Route path="/docs" element={<Navigate to="/docs/llm" replace />} />
        <Route path="/docs/:series" element={<SeriesDetailPage />} />
        {/* splat 路由捕获 /docs/:series/ 之后任意深度的路径作为 slug */}
        <Route path="/docs/:series/*" element={<SeriesOrLegacyDoc />} />

        {/* 旧入口永久重定向 */}
        <Route path="/roadmap" element={<Navigate to="/docs/llm" replace />} />
        <Route path="/roadmap-flow" element={<Navigate to="/docs/llm" replace />} />

        {/* 设置页（APK 离线模式/网络模式/OSS 同步） */}
        <Route path="/settings" element={<Layout />}>
          <Route index element={<SettingsPage />} />
        </Route>
      </Routes>
    </DocModeProvider>
    </ToolbarSizeProvider>
    </StorageProvider>
  )
}

export default App
