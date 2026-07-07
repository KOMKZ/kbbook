/**
 * MetaSyncService — sync series.json and _meta.json file data into SQLite.
 *
 * Design:
 *   - File loading is the caller's responsibility (fetch / fs).
 *   - This module only handles parsing + upsert.
 *   - All upserts use INSERT OR REPLACE (idempotent).
 *   - Existing article word_count/read_time_mins are preserved on re-sync.
 */

import type { IStorageDriver } from '../driver/types.js'
import { SeriesRepo } from '../repo/series.js'
import { GroupRepo } from '../repo/group.js'
import { ArticleRepo } from '../repo/article.js'
import type { SeriesCreate } from '../repo/types.js'

// ── Input types (file format) ────────────────────────────────────────────────

export interface SeriesJsonEntry {
  id: string
  title: string
  shortTitle?: string
  tagline?: string
  description?: string
  version?: string
  language?: string
  color?: string
  icon?: string
  enabled: boolean
}

export interface SeriesJsonFile {
  defaultSeries: string
  series: SeriesJsonEntry[]
}

export interface MetaItem {
  slug: string
  title: string
  order?: number
  isGroup?: boolean
  items?: MetaItem[]
}

export interface MetaJsonFile {
  title?: string
  items: MetaItem[]
}

// ── Sync result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  series: number      // series upserted
  groups: number      // groups upserted
  articles: number    // articles upserted
  errors: string[]
}

// ── Service ──────────────────────────────────────────────────────────────────

export class MetaSyncService {
  private seriesRepo: SeriesRepo
  private groupRepo: GroupRepo
  private articleRepo: ArticleRepo

  constructor(driver: IStorageDriver) {
    this.seriesRepo = new SeriesRepo(driver)
    this.groupRepo = new GroupRepo(driver)
    this.articleRepo = new ArticleRepo(driver)
  }

  /**
   * Sync series data from series.json into the series table.
   * Only enabled series are synced.
   */
  async syncSeries(seriesFile: SeriesJsonFile): Promise<SyncResult> {
    const result: SyncResult = { series: 0, groups: 0, articles: 0, errors: [] }
    const now = Date.now()

    for (const entry of seriesFile.series) {
      if (!entry.enabled) continue
      try {
        const data: SeriesCreate = {
          id: entry.id,
          title: entry.title,
          shortTitle: entry.shortTitle ?? null,
          tagline: entry.tagline ?? null,
          description: entry.description ?? null,
          icon: entry.icon ?? null,
          color: entry.color ?? null,
          enabled: entry.enabled,
          sortOrder: 0,
        }
        // Delete + create (simpler than upsert since we don't have ON CONFLICT for all columns)
        await this.seriesRepo.delete(data.id)
        await this.seriesRepo.create(data)
        // Fix timestamps
        const driver = (this.seriesRepo as any).db as IStorageDriver
        await driver.exec(
          'UPDATE series SET created_at = ?, updated_at = ? WHERE id = ?',
          [now, now, data.id],
        )
        result.series++
      } catch (err) {
        result.errors.push(`series ${entry.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return result
  }

  /**
   * Sync a single _meta.json file: groups + articles for one series.
   *
   * @param seriesId   The series this meta belongs to.
   * @param meta       Parsed _meta.json content.
   */
  async syncMeta(seriesId: string, meta: MetaJsonFile): Promise<SyncResult> {
    const result: SyncResult = { series: 0, groups: 0, articles: 0, errors: [] }

    for (const item of meta.items) {
      try {
        await this.syncItem(seriesId, null, item, result)
      } catch (err) {
        result.errors.push(`item ${item.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return result
  }

  // ── recursive item walker ────────────────────────────────────────────────

  private async syncItem(
    seriesId: string,
    parentGroupId: string | null,
    item: MetaItem,
    result: SyncResult,
  ): Promise<void> {
    const isGroup = item.isGroup === true || (item.items && item.items.length > 0)

    if (isGroup) {
      // Upsert group
      const groupId = `${seriesId}:${item.slug}`
      await this.groupRepo.delete(groupId)
      await this.groupRepo.create({
        id: groupId,
        seriesId,
        parentGroupId,
        title: item.title,
        slug: item.slug,
      })
      result.groups++

      // Recurse into children
      if (item.items) {
        for (const child of item.items) {
          await this.syncItem(seriesId, groupId, child, result)
        }
      }
    } else {
      // Leaf article — only upsert metadata, preserve content stats
      const existing = await this.articleRepo.findBySlug(item.slug)

      if (existing) {
        // Preserve user-generated stats (word_count, read_time_mins)
        await this.articleRepo.update(item.slug, {
          seriesId,
          groupId: parentGroupId ?? undefined,
          title: item.title,
        })
      } else {
        await this.articleRepo.create({
          slug: item.slug,
          seriesId,
          groupId: parentGroupId ?? undefined,
          title: item.title,
          status: 'published',
        })
      }
      result.articles++
    }
  }
}
