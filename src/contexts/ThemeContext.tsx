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

const getInitialMode = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  }
  return 'dark'
}

interface ThemeProviderProps { children: ReactNode }

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

  // Load saved mode from Repo
  useEffect(() => {
    getPreferencesRepo()?.get<ThemeMode>(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved)
    }).catch(() => {})
  }, [])

  const theme = useMemo(() => getTheme(mode), [mode])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    try { getPreferencesRepo()?.set(THEME_STORAGE_KEY, newMode) } catch {}
    document.documentElement.setAttribute('data-theme', newMode)
  }

  const toggleTheme = () => { setMode(mode === 'dark' ? 'light' : 'dark') }

  useEffect(() => { document.documentElement.setAttribute('data-theme', mode) }, [])

  // System theme change listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      getPreferencesRepo()?.get<ThemeMode>(THEME_STORAGE_KEY).then((stored) => {
        if (!stored) setMode(e.matches ? 'dark' : 'light')
      }).catch(() => {})
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const value: ThemeContextValue = { mode, toggleTheme, setMode, isDark: mode === 'dark' }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useThemeMode = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useThemeMode must be used within a ThemeProvider')
  return context
}

export default ThemeContext
