import type { IStorageDriver } from './types.js'
import { LocalStorageDriver } from './localstorage.js'
import { SqlJsDriver } from './sqljs.js'

export type DriverType = 'localstorage' | 'sqljs'

/** Detect which driver types are available in the current runtime. */
export function detectAvailableDrivers(): DriverType[] {
  const available: DriverType[] = ['localstorage'] // always available
  // sql.js requires WASM support (available in modern browsers and Node)
  if (typeof WebAssembly === 'object') {
    available.push('sqljs')
  }
  return available
}

/** Create a driver instance by type. Caller must call open() before use. */
export function createDriver(type: DriverType): IStorageDriver {
  switch (type) {
    case 'localstorage':
      return new LocalStorageDriver()
    case 'sqljs':
      return new SqlJsDriver()
    default:
      throw new Error(`Unknown driver type: ${type}`)
  }
}
