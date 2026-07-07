/**
 * Public types for the IStorageDriver abstraction.
 */

/** A value that can be bound to a SQL parameter. */
export type BindValue = string | number | null | Uint8Array

/** Result of an exec (write) operation. */
export interface ExecResult {
  /** Number of rows affected. */
  changes: number
  /** Rowid of the last inserted row, if any. */
  lastInsertRowid?: number | bigint
}

/**
 * Standardised JSON dump of an entire database.
 *
 * This is the canonical exchange format for cross-driver migration.
 * Every IStorageDriver must be able to produce and consume this.
 */
export interface DatabaseDump {
  /** Format version (currently always 1). */
  version: 1
  /** Date.now() at export time. */
  exportedAt: number
  /** Driver that produced this dump. */
  driverType: string
  /** Migration schema_version at export time. */
  schemaVersion: number
  /**
   * Table name → array of row objects.
   * Each row object maps column name → value (JSON-serialisable).
   */
  tables: Record<string, Record<string, unknown>[]>
}

/**
 * Database-agnostic storage driver.
 *
 * Implementations:
 *   - LocalStorageDriver  (web fallback, kv semantics)
 *   - SqlJsDriver          (web WASM, real SQLite)
 *   - CapacitorSqliteDriver (Android native SQLite)
 */
export interface IStorageDriver {
  /** Initialise the driver. Must be called before any other method. */
  open(): Promise<void>

  /** Release resources. After close(), only open() is valid. */
  close(): Promise<void>

  /** Whether the driver is ready for operations. */
  isOpen(): boolean

  /**
   * Execute a write statement (INSERT, UPDATE, DELETE, CREATE, DROP, etc.).
   *
   * @param sql    SQL statement with `?` placeholders.
   * @param params Values to bind to placeholders in order.
   * @returns Result with changes count and optional lastInsertRowid.
   * @throws DriverNotOpenError if called before open() or after close().
   */
  exec(sql: string, params?: BindValue[]): Promise<ExecResult>

  /**
   * Execute a read statement (SELECT) and return typed rows.
   *
   * @param sql    SQL SELECT statement with `?` placeholders.
   * @param params Values to bind to placeholders in order.
   * @returns Array of row objects with column-name keys.
   * @throws DriverNotOpenError if called before open() or after close().
   */
  query<T = Record<string, unknown>>(sql: string, params?: BindValue[]): Promise<T[]>

  /**
   * Export the entire database as a portable JSON object.
   *
   * Implementation note: drivers that don't natively support introspection
   * (e.g. LocalStorageDriver) should iterate their known keys.
   */
  export(): Promise<DatabaseDump>

  /**
   * Import a previously exported dump, replacing all current data.
   *
   * Implementation note: this should clear existing data first,
   * then insert all rows from the dump using the driver's native API.
   */
  import(dump: DatabaseDump): Promise<void>
}
