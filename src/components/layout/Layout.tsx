import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Header from './Header'
import Footer from './Footer'
import { useScrollMemory } from '../../utils/useScrollMemory'

/**
 * 主布局组件
 * 包含 Header、主内容区、Footer
 */
const Layout = () => {
  // 通用滚动位置记忆：离开页面时保存，回到页面时恢复
  useScrollMemory()
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Header />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  )
}

export default Layout

