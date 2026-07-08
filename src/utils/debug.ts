/**
 * Debug log — captures all console output + global errors.
 * Persisted to localStorage + native file (adb readable).
 * Default enabled. View in Settings → 调试.
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

function save() {
  try {
    const json = JSON.stringify(entries.slice(-MAX))
    localStorage.setItem(KEY, json)
    // Also write to native file (adb: run-as com.lzlab.portal cat files/debug-log.json)
    try {
      const cap = (window as any).Capacitor
      if (cap?.Plugins?.LZPortalSync?.writeDebugLog) {
        cap.Plugins.LZPortalSync.writeDebugLog({ json })
      }
    } catch {}
  } catch {}
}

function add(level: LogEntry['level'], module: string, message: string, detail?: unknown) {
  entries.push({
    id: nextId++, timestamp: Date.now(), level, module, message,
    detail: detail !== undefined ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : undefined,
  })
  if (entries.length % 5 === 0) save()
}

// Hook console (only once)
const _hooked = (window as any).__kbbook_debug_hooked
if (!_hooked) {
  (window as any).__kbbook_debug_hooked = true
  const orig = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...a: unknown[]) => { orig.log(...a); add('info', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
  console.warn = (...a: unknown[]) => { orig.warn(...a); add('warn', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
  console.error = (...a: unknown[]) => { orig.error(...a); add('error', 'console', a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) }
  window.addEventListener('error', (e) => { add('error', 'global', `${e.message} @ ${e.filename}:${e.lineno}`) })
  window.addEventListener('unhandledrejection', (e) => { add('error', 'global', `Rejection: ${e.reason}`, e.reason?.stack) })
}

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
  export(): string { return JSON.stringify(entries, null, 2) },
  clear() { entries = []; nextId = 1; localStorage.removeItem(KEY); save() },
  flush() { save() },
}
