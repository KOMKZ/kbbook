import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '../../contexts/ThemeContext'

/**
 * 主题切换按钮
 */
const ThemeSwitcher = () => {
  const { t } = useTranslation()
  const { mode, toggleTheme } = useThemeMode()

  const isDark = mode === 'dark'
  const label = isDark ? t('common.lightMode', 'Light Mode') : t('common.darkMode', 'Dark Mode')

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleTheme}
        color="inherit"
        aria-label={label}
        sx={{
          transition: 'transform 0.3s ease',
          '&:hover': {
            transform: 'rotate(30deg)',
          },
        }}
      >
        {isDark ? (
          <LightModeIcon sx={{ color: 'text.secondary' }} />
        ) : (
          <DarkModeIcon sx={{ color: 'text.secondary' }} />
        )}
      </IconButton>
    </Tooltip>
  )
}

export default ThemeSwitcher
