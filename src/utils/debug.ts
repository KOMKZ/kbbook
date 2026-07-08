/**
 * Debug log — captures all console output + global errors.
 * Deferred init: localStorage access only on first write (not at import time).
 * Persisted to localStorage + native file (adb readable).
 * View in Settings → 调试.
 */

export interface LogEntry {
  id: number; timestamp: number; level: 'info'|'warn'|'error'; module: string; message: string; detail?: string
}

const MAX = 300, KEY = 'kbbook-debug-log'
let entries: LogEntry[] = [], nextId = 1, _inited = false

function init() {
  if (_inited) return; _inited = true
  // Load persisted entries
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) { entries = p.slice(-MAX); nextId = (entries[entries.length-1]?.id ?? 0)+1 } }
  } catch {}
  // Hook console
  const o = { log: console.log, warn: console.warn, error: console.error }
  console.log   = (...a: unknown[]) => { o.log(...a);   add('info',  'console', a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')) }
  console.warn  = (...a: unknown[]) => { o.warn(...a);  add('warn',  'console', a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')) }
  console.error = (...a: unknown[]) => { o.error(...a); add('error', 'console', a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')) }
  window.addEventListener('error', (e: ErrorEvent) => { add('error','global',`${e.message} @ ${e.filename}:${e.lineno}`) })
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => { add('error','global',`Rejection: ${e.reason}`, (e.reason as any)?.stack) })
}

function save() {
  try {
    const json = JSON.stringify(entries.slice(-MAX))
    localStorage.setItem(KEY, json)
    try { const c = (window as any).Capacitor; if (c?.Plugins?.LZPortalSync?.writeDebugLog) c.Plugins.LZPortalSync.writeDebugLog({json}) } catch {}
  } catch {}
}

function add(level: LogEntry['level'], mod: string, msg: string, detail?: unknown) {
  init()
  entries.push({ id: nextId++, timestamp: Date.now(), level, module: mod, message: msg, detail: detail !== undefined ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : undefined })
  save() // always persist
}

export const debugLog = {
  info(m: string, msg: string, d?: unknown) { add('info', m, msg, d) },
  warn(m: string, msg: string, d?: unknown) { add('warn', m, msg, d) },
  error(m: string, msg: string, d?: unknown) { add('error', m, msg, d) },
  getEntries(): LogEntry[] { init(); return [...entries] },
  getRecent(n=50, mod?: string): LogEntry[] { init(); let f=[...entries]; if(mod)f=f.filter(e=>e.module===mod); return f.slice(-n).reverse() },
  export(): string { init(); return JSON.stringify(entries,null,2) },
  clear() { entries=[]; nextId=1; localStorage.removeItem(KEY); save() },
  flush() { save() },
}
