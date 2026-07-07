import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme, ThemeMode } from '../themes'
import { getPreferencesRepo } from '@/data/bridge.js'

const THEME_STORAGE_KEY = 'kbbook-theme-mode'

interface ThemeContextValue {
  mode: ThemeMode
  toggleTheme: () => void
  setMode: (mode: ThemeMode) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * 获取初始主题模式
 * 优先级：localStorage > 系统偏好 > 默认 dark
 */
const getInitialMode = (): ThemeMode => {
  // 从 localStorage 读取
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  // 检测系统偏好
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  }

  // 默认暗色
  return 'dark'
}

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * 主题 Provider
 * 提供主题切换功能和状态管理
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

  // 主题对象
  const theme = useMemo(() => getTheme(mode), [mode])

  // 设置主题模式
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(THEME_STORAGE_KEY, newMode)
    try { getPreferencesRepo()?.set(THEME_STORAGE_KEY, newMode) } catch {}
    document.documentElement.setAttribute('data-theme', newMode)
  }

  // 切换主题
  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }

  // 初始化时设置 HTML 属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [])

  // 监听系统主题变化（可选）
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有当用户没有手动设置过主题时才响应系统变化
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (!stored) {
        setMode(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const value: ThemeContextValue = {
    mode,
    toggleTheme,
    setMode,
    isDark: mode === 'dark',
  }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

/**
 * 获取主题 Context
 */
export const useThemeMode = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider')
  }
  return context
}

export default ThemeContext
