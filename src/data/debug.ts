/**
 * Debug log — ring-buffer event log for verifying the data layer.
 *
 * Features:
 *   - In-memory ring buffer (max 300 entries)
 *   - Persisted to localStorage (survives page refresh / app restart)
 *   - Default enabled — always capturing
 *   - Console hook — captures console.log/warn/error automatically
 *   - API: debugLog.info/warn/error, getEntries, getRecent, clear, summary
 *
 * View in Settings → 同步 → 调试日志
 * Read via adb: adb shell "run-as com.lzlab.portal cat app_webview/Default/Local\ Storage/leveldb/*.log"
 *   or via CDP: Runtime.evaluate on localStorage.getItem('kbbook-debug-log')
 */

export interface LogEntry {
  id: number
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  module: string
  message: string
  detail?: string
}

const MAX_ENTRIES = 300
const STORAGE_KEY = 'kbbook-debug-log'

let entries: LogEntry[] = []
let nextId = 1
let _enabled = true  // default ON

// ── Persistence ──────────────────────────────────────────────────────────────

function loadFromStorage(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      nextId = data.reduce((max, e) => Math.max(max, e.id || 0), 0) + 1
      return data.slice(-MAX_ENTRIES)
    }
  } catch {}
  return []
}
entries = loadFromStorage()

function persist() {
  try {
    const last = entries.slice(-MAX_ENTRIES)
    const json = JSON.stringify(last)
    localStorage.setItem(STORAGE_KEY, json)
    // In Capacitor WebView, write to files/debug-log.json via native plugin (adb readable)
    try {
      const cap = (window as any).Capacitor
      if (cap?.Plugins?.LZPortalSync?.writeDebugLog) {
        cap.Plugins.LZPortalSync.writeDebugLog({ json })
      }
    } catch {}
  } catch {}
}

// ── Console hook ─────────────────────────────────────────────────────────────

const _origConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

function hookConsole() {
  console.log = function (...args: unknown[]) {
    _origConsole.log(...args)
    debugLog._add('debug', 'console', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '))
  }
  console.warn = function (...args: unknown[]) {
    _origConsole.warn(...args)
    debugLog._add('warn', 'console', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '))
  }
  console.error = function (...args: unknown[]) {
    _origConsole.error(...args)
    debugLog._add('error', 'console', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '))
  }
}
// Hook console immediately
hookConsole()

// Global error capture
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    debugLog.error('global', `${e.message} at ${e.filename}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    debugLog.error('global', `Unhandled rejection: ${e.reason}`, e.reason?.stack)
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export const debugLog = {
  get enabled() { return _enabled },

  setEnabled(v: boolean) {
    _enabled = v
    if (v) this.info('debug', '调试日志已开启')
    else this.info('debug', '调试日志已关闭')
  },

  info(module: string, message: string, detail?: unknown) {
    this._add('info', module, message, detail)
  },

  warn(module: string, message: string, detail?: unknown) {
    this._add('warn', module, message, detail)
  },

  error(module: string, message: string, detail?: unknown) {
    this._add('error', module, message, detail)
  },

  debug(module: string, message: string, detail?: unknown) {
    this._add('debug', module, message, detail)
  },

  _add(level: LogEntry['level'], module: string, message: string, detail?: unknown) {
    const entry: LogEntry = {
      id: nextId++,
      timestamp: Date.now(),
      level,
      module,
      message,
      detail: detail !== undefined ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : undefined,
    }
    entries.push(entry)
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
    // Echo when enabled (except for console-captured messages to avoid double-logging)
    if (_enabled && module !== 'console') {
      const fn = level === 'error' ? _origConsole.error : level === 'warn' ? _origConsole.warn : _origConsole.log
      fn(`[${module}] ${message}`, detail ?? '')
    }
    // Persist every 10 entries
    if (entries.length % 10 === 0) persist()
  },

  getEntries(): LogEntry[] { return [...entries] },

  getRecent(limit = 50, module?: string): LogEntry[] {
    let filtered = [...entries]
    if (module) filtered = filtered.filter(e => e.module === module)
    return filtered.slice(-limit).reverse()
  },

  clear() {
    entries = []
    nextId = 1
    localStorage.removeItem(STORAGE_KEY)
  },

  summary(): { total: number; errors: number; warns: number; info: number; debug: number; modules: string[] } {
    const modules = new Set<string>()
    let errors = 0, warns = 0, inf = 0, dbg = 0
    for (const e of entries) {
      modules.add(e.module)
      if (e.level === 'error') errors++
      else if (e.level === 'warn') warns++
      else if (e.level === 'info') inf++
      else dbg++
    }
    return { total: entries.length, errors, warns, info: inf, debug: dbg, modules: [...modules].sort() }
  },

  /** Export all entries as JSON (for adb retrieval). */
  export(): string { return JSON.stringify(entries, null, 2) },

  /** Force persist now. */
  flush() { persist() },
}
