/**
 * Debug log — lightweight in-memory event log for verifying the data layer.
 *
 * Usage:
 *   import { debugLog } from '@/data/debug.js'
 *   debugLog.info('storage', 'SqlJsDriver opened')
 *   debugLog.warn('sync', 'series.json not found, skipping')
 *   debugLog.error('driver', 'OPFS not available, using in-memory')
 *
 * View in Settings → 外观 → 调试日志
 */

export interface LogEntry {
  id: number
  timestamp: number
  level: 'info' | 'warn' | 'error'
  module: string
  message: string
  detail?: string  // optional JSON detail
}

const MAX_ENTRIES = 200

let entries: LogEntry[] = []
let nextId = 1
let _enabled = false

export const debugLog = {
  get enabled() { return _enabled },

  setEnabled(v: boolean) {
    _enabled = v
    if (v) {
      this.info('debug', '调试日志已开启')
    }
  },

  info(module: string, message: string, detail?: unknown) {
    this._add('info', module, message, detail)
  },

  warn(module: string, message: string, detail?: unknown) {
    this._add('warn', module, message, detail)
  },

  error(module: string, message: string, detail?: unknown) {
    // Errors always log regardless of toggle
    this._add('error', module, message, detail)
  },

  _add(level: LogEntry['level'], module: string, message: string, detail?: unknown) {
    const entry: LogEntry = {
      id: nextId++,
      timestamp: Date.now(),
      level,
      module,
      message,
      detail: detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : undefined,
    }
    entries.push(entry)
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
    // Echo to console only when debug toggle is on
    if (_enabled) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      fn(`[${module}] ${message}`, detail ?? '')
    }
  },

  getEntries(): LogEntry[] { return [...entries] },

  getRecent(limit = 50): LogEntry[] { return entries.slice(-limit).reverse() },

  clear() { entries = []; nextId = 1 },

  /** Summary for quick verification */
  summary(): { total: number; errors: number; warns: number; info: number; modules: string[] } {
    const modules = new Set<string>()
    let errors = 0, warns = 0, inf = 0
    for (const e of entries) {
      modules.add(e.module)
      if (e.level === 'error') errors++
      else if (e.level === 'warn') warns++
      else inf++
    }
    return { total: entries.length, errors, warns, info: inf, modules: [...modules].sort() }
  },
}
