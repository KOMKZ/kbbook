import { createTheme, Theme } from '@mui/material/styles'

/**
 * KBBook 视觉系统
 * 
 * 设计参考：Vercel / Linear / Stripe Docs
 * 关键词：信息层级、可扫描性、阅读舒适、结构感强
 */

// ============================================
// 色彩系统
// ============================================

const palette = {
  // 主色 - 优雅的靛蓝紫
  primary: {
    main: '#5046e5',
    light: '#6366f1',
    dark: '#4338ca',
    contrastText: '#ffffff',
  },
  // 次要色 - 用于辅助强调
  secondary: {
    main: '#0ea5e9',
    light: '#38bdf8',
    dark: '#0284c7',
  },
  // 成功/警告/错误
  success: { main: '#10b981', light: '#34d399', dark: '#059669' },
  warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
  error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
}

// 灰阶系统 - 基于 Tailwind Slate
const gray = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
}

// ============================================
// 字体系统
// ============================================

const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  // 页面主标题 - 非常突出
  h1: {
    fontSize: '2.25rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.025em',
  },
  // 章节标题 - 像分割线
  h2: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
  },
  // 小节标题
  h3: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h6: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  // 正文 - 阅读舒适
  body1: {
    fontSize: '1rem',
    lineHeight: 1.7,
    letterSpacing: '0.01em',
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  // 按钮
  button: {
    textTransform: 'none' as const,
    fontWeight: 500,
    letterSpacing: '0.01em',
  },
  // 小字
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
}

// ============================================
// 亮色主题
// ============================================

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    ...palette,
    background: {
      default: '#ffffff',      // 页面底色 - 纯白
      paper: '#ffffff',        // 卡片/内容区 - 纯白
    },
    text: {
      primary: gray[700],      // 主文本 - 深灰（比黑色柔和）
      secondary: gray[400],    // 次要文本 - 浅灰
    },
    divider: gray[100],        // 分割线 - 极浅灰
    action: {
      hover: gray[50],
      selected: `${palette.primary.main}08`,  // 8% 透明度
      focus: `${palette.primary.main}12`,
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgb(0 0 0 / 0.05)',                              // 1
    '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',  // 2
    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // 3
    '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', // 4
    '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', // 5
    ...Array(19).fill('0 25px 50px -12px rgb(0 0 0 / 0.25)'),
  ] as Theme['shadows'],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollBehavior: 'smooth',
        },
      },
    },
    // AppBar - 顶部导航
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${gray[100]}`,
          boxShadow: 'none',
          color: gray[700],
        },
      },
    },
    // Button - 按钮
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
        },
        contained: {
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${palette.primary.main} 0%, ${palette.primary.dark} 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${palette.primary.dark} 0%, #3730a3 100%)`,
          },
        },
        outlined: {
          borderColor: gray[200],
          '&:hover': {
            borderColor: gray[300],
            backgroundColor: gray[50],
          },
        },
        outlinedPrimary: {
          borderColor: `${palette.primary.main}30`,
          '&:hover': {
            borderColor: palette.primary.main,
            backgroundColor: `${palette.primary.main}05`,
          },
        },
      },
    },
    // Card - 卡片
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${gray[100]}`,
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        },
      },
    },
    // Paper
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: gray[100],
        },
      },
    },
    // Drawer - 侧边栏
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: `1px solid ${gray[100]}`,
        },
      },
    },
    // ListItemButton - 列表项
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '2px 8px',
          padding: '6px 12px',
          '&:hover': {
            backgroundColor: gray[50],
          },
          '&.Mui-selected': {
            backgroundColor: `${palette.primary.main}08`,
            color: palette.primary.main,
            '&:hover': {
              backgroundColor: `${palette.primary.main}12`,
            },
            '& .MuiListItemText-primary': {
              fontWeight: 600,
            },
          },
        },
      },
    },
    // Select
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: gray[200],
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: gray[300],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.primary.main,
            borderWidth: 1,
          },
        },
      },
    },
    // Chip
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        outlined: {
          borderColor: gray[200],
        },
      },
    },
    // Link
    MuiLink: {
      styleOverrides: {
        root: {
          color: palette.primary.main,
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
    // Table
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: gray[100],
        },
        head: {
          fontWeight: 600,
          backgroundColor: gray[50],
          color: gray[600],
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: gray[50],
          },
        },
      },
    },
    // Divider
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: gray[100],
        },
      },
    },
    // Tooltip
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: gray[900],
          fontSize: '0.75rem',
        },
      },
    },
  },
})

// ============================================
// 暗色主题
// ============================================

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    ...palette,
    primary: {
      main: '#818cf8',
      light: '#a5b4fc',
      dark: '#6366f1',
    },
    background: {
      default: '#0a0a0f',
      paper: '#121218',
    },
    text: {
      primary: gray[100],
      secondary: gray[400],
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    action: {
      hover: 'rgba(255, 255, 255, 0.05)',
      selected: 'rgba(129, 140, 248, 0.15)',
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.15)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#121218',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '2px 8px',
          padding: '6px 12px',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(129, 140, 248, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(129, 140, 248, 0.2)',
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
})

// ============================================
// 导出
// ============================================

export type ThemeMode = 'light' | 'dark'

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme
}

// 灰阶导出供组件使用
export { gray }
