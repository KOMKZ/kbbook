# Welcome to KBBook

KBBook is a **multi-series documentation portal** that turns your Markdown files into a beautiful, searchable knowledge base.

## What KBBook gives you

- **Multi-series organization** — Group your content into independent series (e.g., "Go Deep Dive", "System Design", "Machine Learning")
- **Markdown-first** — All content is plain `.md` files. No database, no CMS.
- **Rich rendering** — Mermaid diagrams, KaTeX math, syntax-highlighted code blocks, and responsive tables
- **Full-text search** — Static search index, no backend required
- **Dark mode** — Automatic or manual theme switching
- **Android app** — Package your docs as an APK for offline reading on tablets
- **Zero runtime dependencies** — Build to static files, host anywhere

## Who is KBBook for?

- Developers who want to **document their learning journey**
- Teams who need a **lightweight internal knowledge base**
- Open source projects that want a **docs site** with navigation and search
- Anyone who prefers **writing in Markdown** over using a CMS

## How it works

```text
public/docs/
├── series.json          ← Register your series here
├── versions.json        ← Version configuration
└── zh-CN/
    └── your-series-v0.1.0/
        ├── _meta.json   ← Article directory & navigation
        ├── 01-intro.md
        └── 02-advanced.md
```

1. **Define a series** in `series.json` — give it a name, icon, and color
2. **Create a version directory** (e.g., `your-series-v0.1.0/`)
3. **Write articles** in Markdown
4. **Update `_meta.json`** to register articles in the navigation
5. **Run `pnpm dev`** — your portal is live at `http://localhost:3004`

## Ready to start?

→ **Next: [Quick Start](./02-quickstart.md)** — Clone, install, and run KBBook in 5 minutes.
