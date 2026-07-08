/**
 * 文档工具函数
 * 用于加载和解析文档内容，支持多语言
 *
 * 支持模式切换（本地离线 / 网络直连）：
 *  - 调用 configureDocLoader() 设置 baseUrl 和 readLocalDoc
 *  - loadDocContent / loadDocsMeta / loadVersions / loadSeriesRegistry 自动感知
 */

import i18n from '../i18n'
import { defaultLanguage, type LanguageCode } from '../i18n'

// === Doc loader configuration (set by DocModeContext) ===

let _docBaseUrl = ''
let _readLocalDoc: ((path: string) => Promise<string>) | null = null

/**
 * 配置文档加载器（由 DocModeContext 在初始化时调用）
 * @param baseUrl  网络模式的服务器地址，如 "http://localhost:3004"
 * @param readLocalDoc  本地模式的文档读取函数（通过 Capacitor 插件读取）
 */
export function configureDocLoader(opts: {
  baseUrl?: string
  readLocalDoc?: ((path: string) => Promise<string>) | null
}) {
  if (opts.baseUrl !== undefined) _docBaseUrl = opts.baseUrl
  if (opts.readLocalDoc !== undefined) _readLocalDoc = opts.readLocalDoc
}

/** Get current base URL (for non-doc fetches like roadmap JSON) */
export function getDocBaseUrl(): string {
  return _docBaseUrl
}

// 版本信息类型
export interface VersionInfo {
  version: string
  label: string | Record<string, string>
  path: string
  isLatest: boolean
}

// 解析后的版本信息
export interface ResolvedVersionInfo {
  version: string
  label: string
  path: string
  isLatest: boolean
}

// 文档元数据类型
export interface DocMeta {
  slug: string
  title: string
  order: number
  isGroup?: boolean
  items?: DocMeta[]
}

// 版本配置类型
export interface VersionsConfig {
  versions: VersionInfo[]
  defaultVersion: string
  supportedLanguages: string[]
  defaultLanguage: string
}

// 文档目录元数据类型
export interface DocsMetaConfig {
  title: string
  items: DocMeta[]
}

/**
 * 从 react-router 的 useParams 结果拼出完整 slug。
 * 路由模式:
 *   /docs/:version/:slug              → slug 平铺
 *   /docs/:version/:group/:slug       → slug 嵌套 (group/slug)
 * 任何读取 slug 的组件都应该用这个函数,避免比对 _meta.json 时 mismatch。
 */
export function resolveSlugFromParams(params: { slug?: string; group?: string; '*'?: string }): string | undefined {
  // React Router v6 splat: /docs/:series/*  → params['*'] = "mock/topic-01/PC-M01-001-..."
  const splat = params['*']
  if (splat) return splat || undefined
  // 兼容旧路由格式：group/slug
  const { slug, group } = params
  if (!slug) return undefined
  return group ? `${group}/${slug}` : slug
}

// 文档内容缓存
const docCache = new Map<string, string>()
const metaCache = new Map<string, DocsMetaConfig>()

/**
 * Build DocsMetaConfig tree from SQLite groups + articles tables.
 * Used as replacement for _meta.json file loading.
 */
export async function loadDocsMetaFromRepo(seriesId: string, _version: string): Promise<DocsMetaConfig | null> {
  try {
    const { getDriver } = await import('@/data/bridge.js')
    const { GroupRepo } = await import('@/data/repo/group.js')
    const { ArticleRepo } = await import('@/data/repo/article.js')

    const driver = getDriver()
    if (!driver) return null

    const groupRepo = new GroupRepo(driver)
    const articleRepo = new ArticleRepo(driver)

    const groups = await groupRepo.findBySeries(seriesId)
    const articles = await articleRepo.findBySeries(seriesId)

    // Build parent → children map
    const childrenMap = new Map<string | null, { groups: typeof groups; articles: typeof articles }>()
    for (const g of groups) {
      const key: string | null = g.parentGroupId ?? null
      if (!childrenMap.has(key)) childrenMap.set(key, { groups: [], articles: [] })
      childrenMap.get(key)!.groups.push(g)
    }
    for (const a of articles) {
      const key: string | null = a.groupId ?? null
      if (!childrenMap.has(key)) childrenMap.set(key, { groups: [], articles: [] })
      childrenMap.get(key)!.articles.push(a)
    }

    // Recursively build DocMeta tree
    function buildTree(parentId: string | null): DocMeta[] {
      const items: DocMeta[] = []
      const children = childrenMap.get(parentId)
      if (!children) return items

      for (const g of children.groups) {
        items.push({
          slug: g.slug,
          title: g.title,
          order: g.sortOrder,
          isGroup: true,
          items: buildTree(g.id),
        })
      }
      for (const a of children.articles) {
        items.push({
          slug: a.slug,
          title: a.title,
          order: 0,
        })
      }
      items.sort((a, b) => a.order - b.order)
      return items
    }

    return { title: seriesId, items: buildTree(null) }
  } catch {
    return null
  }
}
let versionsCache: VersionsConfig | null = null

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): LanguageCode {
  const lang = i18n.language
  if (lang === 'zh-CN' || lang.startsWith('zh')) {
    return 'zh-CN'
  }
  return defaultLanguage
}

/**
 * 加载版本配置
 */
export async function loadVersions(): Promise<VersionsConfig> {
  if (versionsCache) {
    return versionsCache
  }

  try {
    const response = await fetch(`${_docBaseUrl}/docs/versions.json`)
    if (!response.ok) {
      throw new Error('Failed to load versions.json')
    }
    versionsCache = await response.json()
    return versionsCache!
  } catch (error) {
    console.error('Error loading versions:', error)
    // 返回默认配置
    return {
      versions: [
        {
          version: '0.1.0',
          label: 'v0.1.0 (初始版)',
          path: 'v0.1.0',
          isLatest: true,
        },
      ],
      defaultVersion: '0.1.0',
      supportedLanguages: ['zh-CN'],
      defaultLanguage: 'zh-CN',
    }
  }
}

/**
 * 解析版本标签（根据当前语言）
 */
export function resolveVersionLabel(label: string | Record<string, string>): string {
  if (typeof label === 'string') {
    return label
  }
  const lang = getCurrentLanguage()
  return label[lang] || label['en-US'] || Object.values(label)[0] || ''
}

/**
 * 获取解析后的版本列表
 */
export function getResolvedVersions(versions: VersionInfo[]): ResolvedVersionInfo[] {
  return versions.map((v) => ({
    version: v.version,
    label: resolveVersionLabel(v.label),
    path: v.path,
    isLatest: v.isLatest,
  }))
}

/**
 * 加载文档目录元数据
 */
export async function loadDocsMeta(version: string, lang?: LanguageCode, seriesId?: string): Promise<DocsMetaConfig> {
  const language = lang || getCurrentLanguage()
  const cacheKey = `meta-${language}-${version}-${seriesId || 'noseries'}`

  if (metaCache.has(cacheKey)) {
    return metaCache.get(cacheKey)!
  }

  // SQLite Repo (StorageProvider guarantees driver is ready)
  if (seriesId) {
    const fromRepo = await loadDocsMetaFromRepo(seriesId, version)
    if (fromRepo && fromRepo.items.length > 0) {
      metaCache.set(cacheKey, fromRepo)
      return fromRepo
    }
  }

  // Empty — return minimal fallback (don't cache)
  return {
    title: '文档',
      items: [
        {
          slug: 'getting-started',
          title: '开始写作',
          order: 1,
          isGroup: true,
          items: [
            {
              slug: '001-overview',
              title: '文档库说明',
              order: 1,
            },
          ],
        },
      ],
    }
}

/**
 * 加载文档内容
 */
export async function loadDocContent(version: string, slug: string, lang?: LanguageCode): Promise<string> {
  const language = lang || getCurrentLanguage()
  const cacheKey = `${language}/${version}/${slug}`
  
  if (docCache.has(cacheKey)) {
    return docCache.get(cacheKey)!
  }

  try {
    // 本地模式: 通过 Capacitor 插件读取（先同步目录，再 APK assets）
    if (_readLocalDoc) {
      try {
        const content = await _readLocalDoc(`${language}/${version}/${slug}`)
        docCache.set(cacheKey, content)
        return content
      } catch {
        // Fall through to fetch-based loading
      }
    }

    const response = await fetch(`${_docBaseUrl}/docs/${language}/${version}/${slug}.md`)
    if (!response.ok) {
      throw new Error(`Failed to load ${slug}.md`)
    }
    // Vite dev SPA fallback 会对缺失的 .md 返回 200 + text/html (index.html)
    // 检测 content-type 与正文起始,识别这种"假 200",当作 404 处理
    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()
    const looksLikeHtmlFallback =
      contentType.includes('text/html') ||
      content.trimStart().startsWith('<!doctype') ||
      content.trimStart().startsWith('<!DOCTYPE') ||
      content.includes('@vite/client') ||
      content.trimStart().startsWith('<script') ||
      content.trimStart().startsWith('<html')
    if (looksLikeHtmlFallback) {
      throw new Error(`Doc not found (got SPA fallback): ${slug}.md`)
    }
    docCache.set(cacheKey, content)
    return content
  } catch (error) {
    console.error('Error loading doc content:', error)
    return `# 文档未找到\n\n无法加载文档: ${slug}`
  }
}

/**
 * 获取默认版本路径
 */
export function getDefaultVersionPath(versions: VersionInfo[]): string {
  const latest = versions.find((v) => v.isLatest)
  return latest?.path || versions[0]?.path || 'v0.1.0'
}

/**
 * 清除缓存（语言切换时使用）
 */
export function clearDocsCache(): void {
  docCache.clear()
  metaCache.clear()
}

// ============================================================
// 系列(Series)层 —— 多系列门户的顶层组织
// ============================================================

import type { Series, SeriesRegistry } from '../types/series'

let seriesCache: SeriesRegistry | null = null

/**
 * 加载系列注册表 /docs/series.json
 */
export async function loadSeriesRegistry(): Promise<SeriesRegistry> {
  if (seriesCache) return seriesCache
  // SQLite Repo (StorageProvider guarantees driver is ready)
  try {
    const { getDriver } = await import('@/data/bridge.js')
    const driver = getDriver()
    if (driver) {
      const { SeriesRepo } = await import('@/data/repo/series.js')
      const repo = new SeriesRepo(driver)
      const all = await repo.findAll()
      if (all.length > 0) {
        const data: SeriesRegistry = {
          defaultSeries: all[0].id,
          series: all.map((s: any) => ({
            id: s.id, title: s.title, shortTitle: s.shortTitle, tagline: s.tagline,
            description: s.description,
            version: s.version || s._version || 'v0.1.0',
            language: s.language || s._language || 'zh-CN',
            color: s.color, icon: s.icon, enabled: s.enabled,
          })),
        }
        seriesCache = data
        return data
      }
    }
  } catch {}
  return { defaultSeries: 'llm', series: [] }
}

/**
 * 按 id 取系列定义。
 */
export async function getSeries(id: string): Promise<Series | undefined> {
  const reg = await loadSeriesRegistry()
  return reg.series.find((s) => s.id === id)
}

/**
 * 加载某系列下的 _meta.json(底层文件路径仍然以 language/version 组织,
 * 这里把 seriesId → version + language 的映射封装起来)。
 */
export async function loadSeriesMeta(seriesId: string): Promise<DocsMetaConfig> {
  const s = await getSeries(seriesId)
  if (!s || !s.version) {
    throw new Error(`Series ${seriesId} has no version mapping`)
  }
  return loadDocsMeta(s.version, (s.language as LanguageCode) ?? undefined, seriesId)
}

/**
 * 加载某系列下的文章 markdown 内容。
 */
export async function loadSeriesDoc(seriesId: string, slug: string): Promise<string> {
  const s = await getSeries(seriesId)
  if (!s || !s.version) {
    throw new Error(`Series ${seriesId} has no version mapping`)
  }
  return loadDocContent(s.version, slug, (s.language as LanguageCode) ?? undefined)
}
