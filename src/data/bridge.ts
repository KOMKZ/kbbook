/**
 * Module-level bridge for accessing the storage layer outside of React context.
 *
 * usePersistentState and other hooks/modules that run before React tree mounts
 * can use this to reach the Repos once storage is initialised.
 */
import type { IStorageDriver } from './driver/types.js'
import type { PreferencesRepo } from './repo/preferences.js'

let _preferences: PreferencesRepo | null = null
let _driver: IStorageDriver | null = null

export function setStorageBridge(prefs: PreferencesRepo, driver?: IStorageDriver) {
  _preferences = prefs
  if (driver) _driver = driver
}

export function getPreferencesRepo(): PreferencesRepo | null {
  return _preferences
}

export function getDriver(): IStorageDriver | null {
  return _driver
}
