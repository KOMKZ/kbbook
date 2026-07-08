import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Fade from '@mui/material/Fade'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import CloseIcon from '@mui/icons-material/Close'

interface MermaidFullscreenProps {
  svgHtml: string
  zoomPercent: number
  isDragging: boolean
  isPng?: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onWheel: (e: React.WheelEvent) => void
  onDragStart: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
}

const MermaidFullscreen = ({
  svgHtml, zoomPercent, isDragging, isPng,
  canvasRef, contentRef,
  onClose, onZoomIn, onZoomOut, onResetView,
  onWheel, onDragStart, onTouchStart,
}: MermaidFullscreenProps) => {

  return (
    <Fade in>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          bgcolor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部工具栏 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.06)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}
          >
            Mermaid Diagram {isPng ? '(PNG)' : '(SVG)'}
          </Typography>

          {/* 缩放控制 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Zoom out (Cmd/Ctrl -)">
              <IconButton size="small" onClick={onZoomOut} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: 'monospace',
                minWidth: 48,
                textAlign: 'center',
                userSelect: 'none',
              }}
            >
              {zoomPercent}%
            </Typography>

            <Tooltip title="Zoom in (Cmd/Ctrl +)">
              <IconButton size="small" onClick={onZoomIn} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Fit to screen (Cmd/Ctrl 0)">
              <IconButton size="small" onClick={onResetView} sx={{ color: 'rgba(255,255,255,0.8)', ml: 1 }}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Tooltip title="Close (Esc)">
            <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.8)' }}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 画布区域 */}
        <Box
          ref={canvasRef}
          onWheel={onWheel}
          onMouseDown={onDragStart}
          onTouchStart={onTouchStart}
          onDoubleClick={onResetView}
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <Box
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transformOrigin: '0 0',
              willChange: 'transform',
              '& svg': {
                display: 'block',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              },
            }}
          />
        </Box>

        {/* 底部提示 */}
        <Box
          sx={{
            px: 3,
            py: 1,
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          {['Scroll: Zoom', 'Drag: Pan', 'Double-click: Fit', 'Esc: Close'].map((hint) => (
            <Typography
              key={hint}
              variant="caption"
              sx={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.7rem' }}
            >
              {hint}
            </Typography>
          ))}
        </Box>
      </Box>
    </Fade>
  )
}

export default MermaidFullscreen
