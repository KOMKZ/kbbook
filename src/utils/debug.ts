/**
 * Debug log — captures all console output + global errors.
 * Persisted to localStorage, displayed in Settings → 调试.
 * Default enabled.
 */

export interface LogEntry {
  id: number
  timestamp: number
  level: 'info' | 'warn' | 'error'
  module: string
  message: string
  detail?: string
}

const MAX = 300
const KEY = 'kbbook-debug-log'
let entries: LogEntry[] = []
let nextId = 1

// Load persisted
try {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      entries = parsed.slice(-MAX)
      nextId = (entries[entries.length - 1]?.id ?? 0) + 1
    }
  }
} catch {}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))) } catch {}
}

function add(level: LogEntry['level'], module: string, message: string, detail?: unknown) {
  entries.push({
    id: nextId++, timestamp: Date.now(), level, module, message,
    detail: detail !== undefined ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : undefined,
  })
  if (entries.length % 10 === 0) save()
}

// Hook console
const orig = { log: console.log, warn: console.warn, error: console.error }
console.log = (...a: unknown[]) => { orig.log(...a); add('info', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
console.warn = (...a: unknown[]) => { orig.warn(...a); add('warn', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
console.error = (...a: unknown[]) => { orig.error(...a); add('error', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }

// Hook global errors
window.addEventListener('error', (e) => {
  add('error', 'global', `${e.message} @ ${e.filename}:${e.lineno}`)
})
window.addEventListener('unhandledrejection', (e) => {
  add('error', 'global', `Rejection: ${e.reason}`, e.reason?.stack)
})

export const debugLog = {
  info(mod: string, msg: string, detail?: unknown) { add('info', mod, msg, detail) },
  warn(mod: string, msg: string, detail?: unknown) { add('warn', mod, msg, detail) },
  error(mod: string, msg: string, detail?: unknown) { add('error', mod, msg, detail) },
  getEntries(): LogEntry[] { return [...entries] },
  getRecent(n = 50, mod?: string): LogEntry[] {
    let filtered = [...entries]
    if (mod) filtered = filtered.filter(e => e.module === mod)
    return filtered.slice(-n).reverse()
  },
  clear() { entries = []; nextId = 1; localStorage.removeItem(KEY) },
  flush() { save() },
}
