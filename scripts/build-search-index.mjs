#!/usr/bin/env node
/**
 * 离线生成全站搜索索引 → public/search-index.json
 *
 * 扫描所有 enabled 系列的 .md 文件,提取标题+纯文本,生成可搜索的 JSON 索引。
 * 在 pnpm build 前运行。
 *
 * 使用: pnpm search:build
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORTAL_ROOT = path.resolve(__dirname, '..')
const SERIES_PATH = path.join(PORTAL_ROOT, 'public/docs/series.json')
const OUTPUT = path.join(PORTAL_ROOT, 'public/search-index.json')

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

// 简单 strip markdown 语法,保留可搜索的中英文文本
function stripMarkdown(md) {
  return md
    .replace(/^#{1,6}\s+/gm, '')           // 标题 #
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接
    .replace(/```[\s\S]*?```/g, '')         // 代码块
    .replace(/`([^`]+)`/g, '$1')            // 行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '')        // 图片
    .replace(/<[^>]+>/g, '')                // HTML 标签
    .replace(/[*_~>|#]/g, '')              // 强调/分隔符
    .replace(/\$\$[\s\S]*?\$\$/g, '')      // LaTeX 块
    .replace(/\$([^$]+)\$/g, '$1')         // LaTeX 行内
    .replace(/\n{3,}/g, '\n\n')            // 压缩空行
    .trim()
}

function extractH1(content) {
  const m = content.match(/^#\s+(.+)$/m)
  if (!m) return ''
  return m[1].replace(/^\[[^\]]+\]\s*/, '').trim()
}

// 从文件名提取 code (如 T00-A01)
function extractCode(filename) {
  const base = path.basename(filename, '.md')
  const m = base.match(/^(T\d+[A-Za-z]?(?:-(?:A|S|R)\d+)?)/)
  return m ? m[1] : null
}

function listMdFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) listMdFiles(full, results)
    else if (e.name.endsWith('.md')) results.push(full)
  }
  return results
}

// 截取摘要:找到匹配关键词附近约 120 字符的上下文
function makeExcerpt(text, maxLen = 120) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

// ====== Main ======

const registry = readJson(SERIES_PATH)
if (!registry || !registry.series) {
  console.error('Failed to read series.json')
  process.exit(1)
}

const index = []
const lang = 'zh-CN'

for (const series of registry.series) {
  if (!series.enabled || !series.version) continue
  const version = series.version
  const docsDir = path.join(PORTAL_ROOT, 'public/docs', series.language || lang, version)
  if (!fs.existsSync(docsDir)) continue

  const mdFiles = listMdFiles(docsDir)
  for (const file of mdFiles) {
    const content = readFile(file)
    if (!content) continue

    const title = extractH1(content)
    if (!title) continue

    const rel = path.relative(docsDir, file).replace(/\\/g, '/')
    const slug = rel.replace(/\.md$/, '')
    const code = extractCode(path.basename(file))
    const text = stripMarkdown(content)
    const excerpt = makeExcerpt(text)

    index.push({
      code: code || '',
      title,
      slug,
      seriesId: series.id,
      seriesTitle: series.title,
      text: text.slice(0, 2000), // 截断长文本,只保留前 2000 字符用于搜索
      excerpt,
    })
  }
}

// 按 code 排序
index.sort((a, b) => a.code.localeCompare(b.code, 'en'))

fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2), 'utf8')
console.log(`✓ Search index generated: ${OUTPUT}`)
console.log(`  indexed ${index.length} articles across ${registry.series.filter(s => s.enabled).length} series`)
