import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import Fade from '@mui/material/Fade'
import StopIcon from '@mui/icons-material/Stop'
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver'
import type { SpeechState } from '../../hooks/useSpeech'

interface Props {
  state: SpeechState
  current: number
  total: number
  onStop: () => void
}

const SpeechBar = ({ state, current, total, onStop }: Props) => {
  const isActive = state === 'speaking'
  const pct = total > 0 ? (current / total) * 100 : 0

  return (
    <Fade in={isActive}>
      <Paper
        elevation={4}
        sx={{
          position: 'fixed',
          bottom: { xs: 80, sm: 24 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          width: 'auto',
          minWidth: { xs: 280, sm: 360 },
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 3,
          px: 2,
          py: 1.5,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <RecordVoiceOverIcon color="primary" fontSize="small" />
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
              朗读中 ({current}/{total})
            </Typography>
            <Tooltip title="停止朗读">
              <IconButton size="small" onClick={onStop} color="error">
                <StopIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 4, borderRadius: 2 }} />
        </Box>
      </Paper>
    </Fade>
  )
}

export default SpeechBar
