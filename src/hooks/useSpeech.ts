import { useState, useCallback, useRef } from 'react'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

export type SpeechState = 'idle' | 'speaking' | 'paused'

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^[>\-*+]\s+/gm, '')
    .replace(/\|.*\|/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\s*[\r\n]/gm, '')
    .trim()
}

// Split text into sentences for pause-able reading
function splitSentences(text: string): string[] {
  const result: string[] = []
  // Split on Chinese/English sentence boundaries
  const parts = text.split(/(?<=[。！？\n])(?=[^\s])|(?<=[.!?\n])(?=\s+[A-Z])/g)
  let buf = ''
  for (const p of parts) {
    const combined = buf + p
    if (combined.length > 500) {
      if (buf) result.push(buf.trim())
      buf = p
    } else {
      buf = combined
    }
  }
  if (buf.trim()) result.push(buf.trim())
  return result.length > 0 ? result : [text]
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const stopRef = useRef(false)
  const isSupported = true

  const speak = useCallback(async (markdown: string) => {
    const plain = stripMarkdown(markdown)
    if (!plain) return

    const sentences = splitSentences(plain)
    stopRef.current = false
    setState('speaking')
    setProgress({ current: 0, total: sentences.length })

    try {
      for (let i = 0; i < sentences.length; i++) {
        if (stopRef.current) break
        setProgress({ current: i + 1, total: sentences.length })
        await TextToSpeech.speak({
          text: sentences[i],
          lang: 'zh-CN',
          rate: 0.95,
          pitch: 1.0,
        })
      }
    } catch (e) {
      console.error('[TTS] error:', e)
    }

    setState('idle')
  }, [])

  const stop = useCallback(async () => {
    stopRef.current = true
    try { await TextToSpeech.stop() } catch {}
    setState('idle')
  }, [])

  return { state, progress, speak, stop, isSupported }
}
