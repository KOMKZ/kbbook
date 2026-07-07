import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import LanguageIcon from '@mui/icons-material/Language'
import CheckIcon from '@mui/icons-material/Check'
import { supportedLanguages, type LanguageCode } from '../../i18n'

interface LanguageSwitcherProps {
  variant?: 'icon' | 'button'
}

/**
 * 语言切换组件
 */
const LanguageSwitcher = ({ variant = 'icon' }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const currentLang = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0]

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLanguageChange = (langCode: LanguageCode) => {
    i18n.changeLanguage(langCode)
    handleClose()
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
            bgcolor: 'rgba(99, 102, 241, 0.08)',
          },
        }}
        aria-label="Change language"
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        {variant === 'icon' ? (
          <LanguageIcon fontSize="small" />
        ) : (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              minWidth: 24,
              textAlign: 'center',
            }}
          >
            {currentLang.shortLabel}
          </Typography>
        )}
      </IconButton>

      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'language-button',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 160,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          },
        }}
      >
        {supportedLanguages.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            selected={i18n.language === lang.code}
            sx={{
              py: 1,
              '&.Mui-selected': {
                bgcolor: 'rgba(99, 102, 241, 0.08)',
              },
              '&:hover': {
                bgcolor: 'rgba(99, 102, 241, 0.04)',
              },
            }}
          >
            <ListItemText
              primary={lang.label}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: i18n.language === lang.code ? 600 : 400,
              }}
            />
            {i18n.language === lang.code && (
              <ListItemIcon sx={{ minWidth: 'auto', ml: 1 }}>
                <CheckIcon fontSize="small" color="primary" />
              </ListItemIcon>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default LanguageSwitcher

