import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { siteConfig } from '../../config/site'

/**
 * 两列页脚:站内导航 + 外部资源。
 */
const Footer = () => {
  const year = new Date().getFullYear()

  const internalLinks = [
    { label: '首页', to: '/' },
  ]

  const externalLinks = [
    { label: 'GitHub', href: siteConfig.githubUrl },
  ]

  return (
    <Box
      component="footer"
      sx={{
        py: 5,
        px: 2,
        mt: 'auto',
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr 1fr' },
            gap: { xs: 3, md: 6 },
            alignItems: 'start',
          }}
        >
          {/* 品牌 */}
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              {siteConfig.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
              {siteConfig.tagline}
            </Typography>
          </Box>

          {/* 站内 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              站内
            </Typography>
            {internalLinks.map((l) => (
              <Link
                key={l.to}
                component={RouterLink}
                to={l.to}
                color="text.secondary"
                display="block"
                sx={{ py: 0.5, textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: 'primary.main' } }}
              >
                {l.label}
              </Link>
            ))}
          </Box>

          {/* 资源 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              资源
            </Typography>
            {externalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                color="text.secondary"
                display="block"
                sx={{ py: 0.5, textDecoration: 'none', fontSize: '0.88rem', '&:hover': { color: 'primary.main' } }}
              >
                {l.label}
              </Link>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            © {year} {siteConfig.footer}
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default Footer
