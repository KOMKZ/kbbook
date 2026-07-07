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
- **Templates**: See `.claude/templates/`

## Key Rules

- All branding comes from `src/config/site.ts` — never hardcode the site name
- Content files are data, not code — they don't need to be brand-free
- Scripts in `scripts/portal/` are Python 3 CLI tools for content management
- `public/search-index.json` must be rebuilt after adding/modifying articles
- The Capacitor plugin (`lz-portal-sync`) handles offline doc sync on Android
