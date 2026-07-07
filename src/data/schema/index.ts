/**
 * Schema registry — all migrations in version order.
 */

export type { Migration } from './migrations.js'
export { MigrationRunner } from './migrations.js'
export { v001 } from './v001_initial.js'

import { v001 } from './v001_initial.js'
import { v002 } from './v002_initial_data.js'
import type { Migration } from './migrations.js'

/** All migrations, ordered by version. Append new ones at the end. */
export const allMigrations: Migration[] = [v001, v002]
