import type { IStorageDriver } from '../driver/types.js'

export interface ArticleLink {
  id: number
  sourceSlug: string
  targetSlug: string
  linkType: 'reference' | 'prerequisite' | 'extends' | 'related'
  context?: string | null
}

export interface ArticleLinkCreate {
  sourceSlug: string
  targetSlug: string
  linkType?: ArticleLink['linkType']
  context?: string | null
}

export interface LinkGraphNode {
  slug: string
  title: string
  incomingCount: number
  outgoingCount: number
}

export interface LinkGraphEdge {
  source: string
  target: string
  linkType: string
}

export class ArticleLinkRepo {
  constructor(private db: IStorageDriver) {}

  async createLink(input: ArticleLinkCreate): Promise<ArticleLink> {
    await this.db.exec(
      `INSERT OR IGNORE INTO article_links (source_slug, target_slug, link_type, context)
       VALUES (?, ?, ?, ?)`,
      [input.sourceSlug, input.targetSlug, input.linkType ?? 'reference', input.context ?? null],
    )
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT id, source_slug, target_slug, link_type, context FROM article_links WHERE source_slug = ? AND target_slug = ? AND link_type = ?',
      [input.sourceSlug, input.targetSlug, input.linkType ?? 'reference'],
    )
    return rowToLink(rows[0])
  }

  async removeLink(id: number): Promise<void> {
    await this.db.exec('DELETE FROM article_links WHERE id = ?', [id])
  }

  async findBySource(slug: string): Promise<ArticleLink[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT id, source_slug, target_slug, link_type, context FROM article_links WHERE source_slug = ? ORDER BY id',
      [slug],
    )
    return rows.map(rowToLink)
  }

  async findByTarget(slug: string): Promise<ArticleLink[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT id, source_slug, target_slug, link_type, context FROM article_links WHERE target_slug = ? ORDER BY id',
      [slug],
    )
    return rows.map(rowToLink)
  }

  async countIncoming(slug: string): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM article_links WHERE target_slug = ?',
      [slug],
    )
    return rows[0]?.cnt ?? 0
  }

  async countOutgoing(slug: string): Promise<number> {
    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM article_links WHERE source_slug = ?',
      [slug],
    )
    return rows[0]?.cnt ?? 0
  }

  /**
   * Get nodes and edges for a link graph.
   * If seriesId is provided, only articles in that series are included.
   */
  async getLinkGraph(seriesId?: string): Promise<{ nodes: LinkGraphNode[]; edges: LinkGraphEdge[] }> {
    let nodeSql: string
    let nodeParams: string[] = []
    if (seriesId) {
      nodeSql = `SELECT a.slug, a.title,
        COALESCE(incoming.cnt, 0) as incoming_count,
        COALESCE(outgoing.cnt, 0) as outgoing_count
      FROM articles a
      LEFT JOIN (SELECT target_slug, COUNT(*) as cnt FROM article_links GROUP BY target_slug) incoming ON a.slug = incoming.target_slug
      LEFT JOIN (SELECT source_slug, COUNT(*) as cnt FROM article_links GROUP BY source_slug) outgoing ON a.slug = outgoing.source_slug
      WHERE a.series_id = ?
        AND (incoming.cnt > 0 OR outgoing.cnt > 0)`
      nodeParams = [seriesId]
    } else {
      nodeSql = `SELECT a.slug, a.title,
        COALESCE(incoming.cnt, 0) as incoming_count,
        COALESCE(outgoing.cnt, 0) as outgoing_count
      FROM articles a
      LEFT JOIN (SELECT target_slug, COUNT(*) as cnt FROM article_links GROUP BY target_slug) incoming ON a.slug = incoming.target_slug
      LEFT JOIN (SELECT source_slug, COUNT(*) as cnt FROM article_links GROUP BY source_slug) outgoing ON a.slug = outgoing.source_slug
      WHERE incoming.cnt > 0 OR outgoing.cnt > 0`
    }

    const nodes = await this.db.query<LinkGraphNode>(nodeSql, nodeParams)
    const edges = await this.db.query<LinkGraphEdge>(
      'SELECT source_slug as source, target_slug as target, link_type as linkType FROM article_links' +
        (seriesId ? ' WHERE source_slug IN (SELECT slug FROM articles WHERE series_id = ?)' : ''),
      seriesId ? [seriesId] : [],
    )
    return { nodes, edges }
  }

  /**
   * Find articles related to the given slug (share common references).
   */
  async getRelatedArticles(slug: string, limit = 5): Promise<{ slug: string; title: string; sharedCount: number }[]> {
    return this.db.query(
      `SELECT a2.slug, a2.title, COUNT(*) as "sharedCount"
       FROM article_links l1
       JOIN article_links l2 ON l1.target_slug = l2.target_slug AND l1.source_slug != l2.source_slug
       JOIN articles a2 ON l2.source_slug = a2.slug
       WHERE l1.source_slug = ?
       GROUP BY a2.slug, a2.title
       ORDER BY "sharedCount" DESC
       LIMIT ?`,
      [slug, limit],
    )
  }
}

function rowToLink(r: Record<string, unknown>): ArticleLink {
  return {
    id: r.id as number,
    sourceSlug: r.source_slug as string,
    targetSlug: r.target_slug as string,
    linkType: (r.link_type as ArticleLink['linkType']) ?? 'reference',
    context: (r.context as string) ?? null,
  }
}
