import type { IStorageDriver } from '../driver/types.js'
import { exportDatabase, importDatabase, verifyExport } from './exporter.js'

export interface SwitchReport {
  success: boolean
  tables: Record<string, number>  // table → row count in new driver
  totalRows: number
  durationMs: number
  error?: string
}

/**
 * Migrate all data from one driver to another.
 * The source driver is closed after successful migration.
 * On failure, both drivers are left open so the caller can retry.
 */
export async function switchDriver(from: IStorageDriver, to: IStorageDriver): Promise<SwitchReport> {
  const started = Date.now()
  try {
    const dump = await exportDatabase(from)
    const verification = verifyExport(dump)
    if (!verification.valid) {
      return { success: false, tables: {}, totalRows: 0, durationMs: Date.now() - started, error: verification.errors.join('; ') }
    }

    await importDatabase(to, dump)

    let totalRows = 0
    const tables: Record<string, number> = {}
    for (const [name, rows] of Object.entries(dump.tables)) {
      tables[name] = rows.length
      totalRows += rows.length
    }

    // Close old driver only on success
    await from.close()

    return { success: true, tables, totalRows, durationMs: Date.now() - started }
  } catch (err) {
    // Source driver remains open — data is preserved
    return {
      success: false,
      tables: {},
      totalRows: 0,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
