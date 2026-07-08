import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles/global.css'
import './styles/prism-theme.css'

// 初始化 i18n
import './i18n'

// 启动全局调试日志（Console hook + Error capture，设置→调试）
// ⚠️ 必须具名导入，纯副作用 import 会被 Vite tree-shake 删除
import { debugLog } from './utils/debug'
debugLog.info('app', 'App starting')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
