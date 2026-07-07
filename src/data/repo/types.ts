/**
 * Entity types for the repository layer.
 * These mirror the database schema defined in v001_initial.ts.
 */

export interface Series {
  id: string
  title: string
  shortTitle?: string | null
  tagline?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
  enabled: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export type SeriesCreate = Omit<Series, 'createdAt' | 'updatedAt'>
export type SeriesUpdate = Partial<Omit<Series, 'id' | 'createdAt' | 'updatedAt'>>

export interface Group {
  id: string
  seriesId: string
  parentGroupId?: string | null
  title: string
  slug: string
  sortOrder: number
}

export type GroupCreate = Omit<Group, 'sortOrder'>
export type GroupUpdate = Partial<Omit<Group, 'id' | 'seriesId'>>

export interface Article {
  slug: string
  seriesId: string
  groupId?: string | null
  title: string
  description?: string | null
  content?: string | null
  wordCount: number
  readTimeMins: number
  status: 'draft' | 'published' | 'archived'
  tags?: string | null       // JSON array
  frontmatter?: string | null // JSON object
  createdAt: number
  updatedAt: number
}

export type ArticleCreate = Omit<Article, 'createdAt' | 'updatedAt'>
export type ArticleUpdate = Partial<Omit<Article, 'slug' | 'createdAt' | 'updatedAt'>>
