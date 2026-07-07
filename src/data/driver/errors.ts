/**
 * Errors thrown by IStorageDriver implementations.
 */

/** Operation attempted on a closed (or not-yet-opened) driver. */
export class DriverNotOpenError extends Error {
  constructor(driverName: string) {
    super(`${driverName}: driver is not open. Call open() first.`)
    this.name = 'DriverNotOpenError'
  }
}

/** The driver cannot handle the given SQL (e.g. LocalStorageDriver can't do JOIN). */
export class UnsupportedQueryError extends Error {
  constructor(driverName: string, sql: string) {
    super(`${driverName}: unsupported SQL — "${sql.slice(0, 80)}${sql.length > 80 ? '...' : ''}"`)
    this.name = 'UnsupportedQueryError'
  }
}
