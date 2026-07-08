import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles/global.css'
import './styles/prism-theme.css'

// 初始化 i18n
import './i18n'

// 启动全局调试日志
import { debugLog } from './utils/debug'

// 延迟 500ms 确保 DOM/localStorage 就绪
setTimeout(() => {
  try {
    debugLog.info('app', 'App started')
    localStorage.setItem('_kbbook_alive', String(Date.now()))
  } catch(e) {}
}, 500)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
