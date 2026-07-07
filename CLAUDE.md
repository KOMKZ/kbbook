# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## KBBook Overview

KBBook is a multi-series documentation portal. Turn Markdown files into a searchable knowledge base with Mermaid diagrams, KaTeX math, code highlighting, dark mode, and Android app support.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start Vite dev server (port 3004)
pnpm build            # TypeScript + Vite production build
pnpm lint             # ESLint
pnpm search:build     # Rebuild search index
make help             # Show all Makefile targets
```

## Architecture

```
src/
├── config/site.ts         # Branding configuration (central source for site name, etc.)
├── components/
│   ├── layout/            # Header, Footer, Layout shell
│   ├── docs/              # MarkdownRenderer, Sidebar, Breadcrumbs, SearchDialog, etc.
│   ├── home/              # HomePage components (SeriesCard, QuoteBanner)
│   ├── settings/          # Settings panel
│   └── common/            # ThemeSwitcher, LanguageSwitcher
├── pages/
│   ├── HomePage.tsx       # Multi-series landing page
│   ├── docs/DocsPage.tsx  # Article reader page
│   └── series/SeriesDetailPage.tsx  # Series landing page
├── contexts/              # ThemeContext, DocModeContext, ToolbarSizeContext
├── hooks/                 # useReadingHistory, useSpeech, useToolbarSize
├── utils/                 # docs.ts (content loader), useSeriesOrder, etc.
├── types/                 # Series, SiteConfig type definitions
├── themes/                # MUI light/dark theme definitions
├── plugins/lz-portal-sync/ # Capacitor native plugin bridge
└── i18n/                  # Internationalization
```

## Content Organization

All content lives under `public/docs/`:

- `series.json` — Series registry (id, title, version, enabled, etc.)
- `versions.json` — Version/language configuration
- `{lang}/{series}-{version}/_meta.json` — Navigation structure
- `{lang}/{series}-{version}/*.md` — Article files

## Agent Instructions

- **Writing articles**: See `.claude/agents/writer.md`
- **Engineering articles**: See `.claude/agents/engineering-writer.md`
- **Go articles**: See `.claude/agents/go-writer.md`
- **Portal development**: See `.claude/agents/portal-dev.md`
- **Review**: See `.claude/agents/reviewer.md`
- **Writing Templates**: See `.claude/templates/` (15 templates covering derivation, engineering, Go, ops, algorithms — synced from lz-ai-learning)

## Key Rules

- All branding comes from `src/config/site.ts` — never hardcode the site name
- Content files are data, not code — they don't need to be brand-free
- Scripts in `scripts/portal/` are Python 3 CLI tools for content management
- `public/search-index.json` must be rebuilt after adding/modifying articles
- The Capacitor plugin (`lz-portal-sync`) handles offline doc sync on Android

---

## SQLite Data Layer — Pitfalls & Lessons

> **这些坑在 2026-07-07 ~ 07-08 的 SQLite 数据层开发中反复踩过，记录下来避免重犯。**

### 1. Vite + sql.js WASM 打包

**错误方式**:
```ts
// ❌ CDN locateFile — APK 离线不可达
initSqlJs({ locateFile: () => 'https://cdn.jsdelivr.net/...' })

// ❌ 不传配置 — sql.js 默认 fetch 'sql-wasm.wasm'，Vite 不打包
initSqlJs()
```

**正确方式**:
```ts
// ✅ ?url import 让 Vite 打包 WASM，返回运行时 URL
const wasm = await import('sql.js/dist/sql-wasm.wasm?url')
initSqlJs({ locateFile: () => wasm.default })
```

`?url` 是 Vite 特殊后缀，告诉打包器把文件包含进产物。不加的话 `.wasm` 文件不会在 APK 里。

### 2. APK 调试

APK 里的 WebView 没有 Chrome DevTools。用 `adb logcat` 看 console：

```bash
# 清日志 → 启动 App → 抓 StorageProvider 日志
adb logcat -c
adb logcat -d | grep 'Capacitor/Console'
```

关键日志关键词：`StorageProvider`、`kbdata`、`wasm`、`init complete`

### 3. 数据文件分离

- **KBBook（公开）**: 只能有 demo 数据。数据层代码可以有，但不能嵌入真实数据。
- **lz-learn-portal（私有）**: build 时从 `public/docs/` 生成 `.kbdata`，打包进 APK。
- 生成命令: `node scripts/kbdata-cli.mjs build-init-db public/docs --db public/kbbsqllite-init.kbdata`

### 4. 启动流程

StorageProvider 启动顺序：
```
open sqljs → run migrations → 检查 articles 是否为空
  ├─ 空 → fetch /kbbsqllite-init.kbdata → 逐表导入
  └─ 有数据 → 跳过
→ setState({ ready: true }) → render children
```

**必须** block render 直到 ready，否则组件会在数据未就绪时渲染（缓存空结果，永久白屏）。

### 5. 数据源（架构铁律）

- **运行时不读 _meta.json / series.json**。这些文件仅用于 build 时生成 .kbdata。
- 所有运行时数据从 SQLite 读取。
- 文章正文（.md）仍从文件系统读取——正文不存 SQLite。

### 6. 迁移数据不进 KBBook git

v002 migration 嵌入 INSERT 语句 = 把私有数据提交到公开仓库。
用 `.kbdata` 二进制文件代替，由 lz-learn-portal build 时生成，不进入 git。

---

## Knowledge Boundary & Gate

> **原则**: 本项目是公开的开源工具。`CLAUDE.md` 和 `.claude/agents/` 跟着 git 走，clone 的人都能看到。

### 什么属于这里

| 类型 | 位置 | 判断标准 |
|------|------|---------|
| 通用写作原则 | `.claude/agents/writer.md` | 任何技术写作者都需要 |
| Portal 开发规范 | `.claude/agents/portal-dev.md` | 任何 KBBook 开发者都需要 |
| 文章评审清单 | `.claude/agents/reviewer.md` | 任何内容作者都需要 |
| 写作模板 | `.claude/templates/` | 语言/领域无关的模板结构 |
| 项目架构/命令 | `CLAUDE.md` | 项目 overview，面向贡献者 |

### 什么**禁止**放这里（阻断规则）

| 禁止类型 | 为什么 | 正确去向 |
|---------|--------|---------|
| 个人路径 (`~/pro/yogan/...`) | 别人 clone 后不存在 | → `kbbook-dev` skill 的 `scripts/` |
| 个人品牌 (`LZ Lab`) | 这是 KBBook，不是 LZ Lab | → `lz-learn-portal` 的 `siteConfig` 覆盖 |
| 个人账号/token/密码 | 安全红线 | → 不存在任何地方，用 `.env` |
| 双仓同步流程 | 别人没有私有仓 | → `kbbook-dev` skill |
| LZ 特定的写作规则/反馈 | 别人不需要 | → `lz-ai-learning` skill |
| SOP 脚本（含硬编码路径） | 路径不通用 | → `kbbook-dev` skill `scripts/` |

### 新增知识门禁（每次往 `.claude/agents/` 加内容前自检）

```
□ 这个规则 clone KBBook 的陌生人需要吗？
   NO → 不放这里，判断去向（见下方路由）
□ 包含个人路径/品牌/账号吗？
   YES → 阻断，不放这里
□ 能用英文写吗（开源项目默认语言）？
   NO → 考虑是否应该放在私有 skill 中
```

### 路由决策树（新知识应该沉淀到哪？）

```
新规则/模板/agent/脚本
│
├─ 含个人路径、品牌、账号？
│   └─ YES → 🚫 阻断。kbbook-dev scripts/ 或 .env
│
├─ clone KBBook 的陌生人也需要？
│   ├─ 关于怎么写文章 → .claude/agents/writer.md
│   ├─ 关于怎么开发 portal → .claude/agents/portal-dev.md
│   ├─ 关于怎么评审 → .claude/agents/reviewer.md
│   ├─ 关于模板结构 → .claude/templates/
│   └─ 关于项目本身 → CLAUDE.md
│
├─ 只在我们双仓工作流中有意义？
│   └─ YES → kbbook-dev skill（scripts/ 或 SKILL.md）
│
└─ 只跟 LZ 个人内容/写作/学习有关？
    └─ YES → lz-ai-learning skill（modules/ / templates/ / feedback-log/）
```
