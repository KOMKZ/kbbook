import React, { useState, useCallback, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Fade from '@mui/material/Fade'
import TextDecreaseIcon from '@mui/icons-material/TextDecrease'
import TextIncreaseIcon from '@mui/icons-material/TextIncrease'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useTheme } from '@mui/material/styles'

/** 超过此列数自动启用宽表模式 */
const WIDE_COLUMN_THRESHOLD = 6

const FONT_MIN = 0.5
const FONT_MAX = 2.0
const FONT_STEP = 0.1
const FONT_DEFAULT = 1.0

const clamp = (v: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v * 10) / 10))

interface WideTableProps {
  children: ReactNode
}

/**
 * 宽表预览组件
 *
 * 当表格列数超过 WIDE_COLUMN_THRESHOLD 时自动启用：
 * - 首列（通常是编号列）position: sticky 固定在左侧
 * - 右上角浮层工具栏：字体放大/缩小/重置
 * - 列数 ≤ 阈值时退化为普通 TableContainer（与 MarkdownRenderer 原有行为一致）
 */
const WideTable: React.FC<WideTableProps> = ({ children }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [fontScale, setFontScale] = useState(FONT_DEFAULT)
  const [showToolbar, setShowToolbar] = useState(true)

  // 从 children 中提取列数
  const columnCount = countTableColumns(children)

  const isWide = columnCount > WIDE_COLUMN_THRESHOLD

  const zoomIn = useCallback(() => setFontScale((s) => clamp(s + FONT_STEP)), [])
  const zoomOut = useCallback(() => setFontScale((s) => clamp(s - FONT_STEP)), [])
  const zoomReset = useCallback(() => setFontScale(FONT_DEFAULT), [])

  // ---- 普通表格（列数不多）----
  if (!isWide) {
    return (
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ my: 3, borderRadius: 2, overflow: 'auto' }}
      >
        <Table size="small" sx={{ minWidth: 400 }}>
          {children}
        </Table>
      </TableContainer>
    )
  }

  // ---- 宽表模式：首列冻结 + 工具栏 ----
  const bgColor = isDark ? 'rgba(30,30,50,0.97)' : theme.palette.background.paper

  return (
    <Box sx={{ position: 'relative', my: 3 }}>
      {/* 工具栏 */}
      {showToolbar ? (
        <Fade in>
          <Paper
            variant="outlined"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.75,
              py: 0.25,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(20,20,35,0.92)' : 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Tooltip title="缩小字体" placement="top">
              <span>
                <IconButton size="small" onClick={zoomOut} disabled={fontScale <= FONT_MIN}>
                  <TextDecreaseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography
              variant="caption"
              sx={{ minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}
            >
              {Math.round(fontScale * 100)}%
            </Typography>
            <Tooltip title="放大字体" placement="top">
              <span>
                <IconButton size="small" onClick={zoomIn} disabled={fontScale >= FONT_MAX}>
                  <TextIncreaseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="恢复默认" placement="top">
              <span>
                <IconButton size="small" onClick={zoomReset} disabled={fontScale === FONT_DEFAULT}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="隐藏工具栏" placement="top">
              <IconButton size="small" onClick={() => setShowToolbar(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        </Fade>
      ) : (
        <Tooltip title="显示表格工具" placement="left">
          <IconButton
            size="small"
            onClick={() => setShowToolbar(true)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              bgcolor: isDark ? 'rgba(20,20,35,0.7)' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: isDark ? 'rgba(40,40,60,0.9)' : 'rgba(240,240,240,0.9)' },
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* 表格容器 */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: 'auto',
          maxWidth: '100%',
          // 滚动条在暗色模式下更明显
          ...(isDark && {
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.03)' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 4 },
          }),
        }}
      >
        <Table
          size="small"
          sx={{
            // 字体缩放
            '& .MuiTableCell-root': {
              fontSize: `calc(0.875rem * ${fontScale})`,
              lineHeight: fontScale < 0.7 ? 1.3 : 1.5,
              transition: 'font-size 0.15s ease',
            },
          }}
        >
          {injectStickyFirstColumn(children, bgColor, isDark)}
        </Table>
      </TableContainer>

      {/* 底部提示 */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', textAlign: 'right', mt: 0.5, px: 1 }}
      >
        {columnCount} 列 · 左右滑动查看更多 ← →
      </Typography>
    </Box>
  )
}

// ---- helpers ----

/**
 * 递归统计 react-markdown 生成的 table children 中的列数
 * 找到第一个 thead > tr 或 tbody > tr，数其 th/td 个数
 */
function countTableColumns(children: ReactNode): number {
  const kids = React.Children.toArray(children)
  for (const kid of kids) {
    if (!React.isValidElement(kid)) continue
    // thead 或 tbody
    const grandKids = React.Children.toArray((kid.props as any)?.children)
    for (const gk of grandKids) {
      if (!React.isValidElement(gk)) continue
      // tr
      const cells = React.Children.toArray((gk.props as any)?.children)
      const count = cells.filter((c) => React.isValidElement(c)).length
      if (count > 0) return count
    }
  }
  return 0
}

/**
 * 遍历 table 的 children，给每行第一个单元格注入 position: sticky
 * 使其在横向滚动时固定在左侧
 */
function injectStickyFirstColumn(children: ReactNode, bgColor: string, isDark: boolean): ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    const childType = (child as any)?.type
    // 处理 thead / tbody
    if (childType === 'thead' || childType === 'tbody' || childType === TableHead || childType === TableBody) {
      const grandKids = React.Children.map((child.props as any)?.children, (tr: any) => {
        if (!React.isValidElement(tr)) return tr
        return React.cloneElement(tr as React.ReactElement<any>, {
          children: React.Children.map((tr.props as any)?.children, (cell: any, idx: number) => {
            if (!React.isValidElement(cell) || idx !== 0) return cell
            const isHeader = childType === 'thead' || childType === TableHead
            return React.cloneElement(cell as React.ReactElement<any>, {
              sx: {
                ...((cell.props as any)?.sx || {}),
                position: 'sticky',
                left: 0,
                zIndex: isHeader ? 3 : 2,
                bgcolor: bgColor,
                // 右边加阴影指示"还有更多列"
                boxShadow: isDark
                  ? '2px 0 8px rgba(0,0,0,0.4)'
                  : '2px 0 8px rgba(0,0,0,0.08)',
                minWidth: 60,
                fontWeight: isHeader ? 600 : (cell.props as any)?.sx?.fontWeight,
                whiteSpace: 'nowrap',
              },
            })
          }),
        })
      })
      return React.cloneElement(child as React.ReactElement<any>, {}, grandKids)
    }
    return child
  })
}

export default React.memo(WideTable)
