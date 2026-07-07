/**
 * Module-level bridge for accessing the storage layer outside of React context.
 *
 * usePersistentState and other hooks/modules that run before React tree mounts
 * can use this to reach the Repos once storage is initialised.
 */
import type { PreferencesRepo } from './repo/preferences.js'

let _preferences: PreferencesRepo | null = null

export function setStorageBridge(prefs: PreferencesRepo) {
  _preferences = prefs
}

export function getPreferencesRepo(): PreferencesRepo | null {
  return _preferences
}
