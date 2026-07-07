import type { IStorageDriver, DatabaseDump } from '../driver/types.js'

export interface ExportReport {
  tableCount: number
  totalRows: number
  tables: Record<string, number>  // table → row count
}

/** Export all user tables from a driver as a DatabaseDump. */
export async function exportDatabase(driver: IStorageDriver): Promise<DatabaseDump> {
  return driver.export()
}

/** Import a DatabaseDump into a driver, replacing all existing data. */
export async function importDatabase(driver: IStorageDriver, dump: DatabaseDump): Promise<void> {
  await driver.import(dump)
}

/** Verify a DatabaseDump has the required structure. */
export function verifyExport(dump: DatabaseDump): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (dump.version !== 1) errors.push(`unsupported dump version: ${dump.version}`)
  if (typeof dump.exportedAt !== 'number') errors.push('missing exportedAt')
  if (typeof dump.schemaVersion !== 'number') errors.push('missing schemaVersion')
  if (typeof dump.tables !== 'object' || dump.tables === null) errors.push('tables must be an object')
  return { valid: errors.length === 0, errors }
}

/** Summarise a DatabaseDump for reporting. */
export function summariseDump(dump: DatabaseDump): ExportReport {
  let totalRows = 0
  const tables: Record<string, number> = {}
  for (const [name, rows] of Object.entries(dump.tables)) {
    tables[name] = rows.length
    totalRows += rows.length
  }
  return { tableCount: Object.keys(tables).length, totalRows, tables }
}

/** Compare two dumps — returns row count diff per table. */
export function diffDumps(a: DatabaseDump, b: DatabaseDump): Record<string, { a: number; b: number; diff: number }> {
  const allTables = new Set([...Object.keys(a.tables), ...Object.keys(b.tables)])
  const result: Record<string, { a: number; b: number; diff: number }> = {}
  for (const name of allTables) {
    const ac = a.tables[name]?.length ?? 0
    const bc = b.tables[name]?.length ?? 0
    result[name] = { a: ac, b: bc, diff: bc - ac }
  }
  return result
}
