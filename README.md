# KBBook

**A multi-series documentation portal powered by Markdown.**

Turn your Markdown files into a beautiful, searchable knowledge base — with Mermaid diagrams, KaTeX math, syntax highlighting, dark mode, and Android app support. Zero runtime dependencies. Deploy anywhere.

## Features

- 📚 **Multi-series organization** — Group content into independent series with their own navigation
- 📝 **Markdown-first** — All content is plain `.md` files. No database, no CMS.
- 🎨 **Rich rendering** — Mermaid diagrams, KaTeX math, code highlighting, responsive tables
- 🔍 **Full-text search** — Static search index, no backend required
- 🌙 **Dark mode** — Auto-detection or manual toggle
- 📱 **Android app** — Package your docs as an APK for offline reading (via Capacitor)
- ⚡ **Zero runtime deps** — Builds to static files, host anywhere

## Quick Start

```bash
git clone https://github.com/KOMKZ/kbbook.git
cd kbbook
pnpm install
pnpm dev
```

Open `http://localhost:3004` — the demo series is ready to explore.

## How It Works

```text
public/docs/
├── series.json          ← Register your series here
├── versions.json        ← Version configuration
└── zh-CN/               ← Language directories
    └── your-series-v0.1.0/
        ├── _meta.json   ← Article directory & navigation
        ├── 01-intro.md
        └── 02-advanced.md
```

1. **Define a series** in `series.json`
2. **Write articles** in Markdown
3. **Update `_meta.json`** for navigation
4. **Run `pnpm dev`** — your portal is live

## Configuration

Edit `src/config/site.ts` to customize your portal's branding:

```typescript
export const siteConfig: SiteConfig = {
  name: 'My Docs',
  shortName: 'Docs',
  tagline: 'Your Knowledge Base, in Book Form',
  // ...
}
```

Or use environment variables:

```bash
VITE_SITE_NAME="My Docs" pnpm dev
```

## Adding Your First Series

```bash
# Initialize a new series
python3 scripts/portal/portal-series-init my-series \
  --title "My Series" \
  --icon "📚" --color "#5046e5"

# Write articles
echo "# Hello" > public/docs/zh-CN/my-series-v0.1.0/01-hello.md

# Rebuild metadata
python3 scripts/portal/portal-meta-rebuild public/docs/zh-CN/my-series-v0.1.0

# Rebuild search index
pnpm search:build
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (port 3004) |
| `pnpm build` | Production build |
| `pnpm search:build` | Rebuild search index |
| `make help` | Show all Makefile targets |

See the [Getting Started series](http://localhost:3004/docs/demo) for detailed documentation.

## Tech Stack

- React 18 + TypeScript
- Material UI
- React Router v7
- React Markdown + rehype-raw + remark-gfm
- Mermaid (diagrams)
- KaTeX (math)
- Prism.js (code highlighting)
- Capacitor (Android app)
- Vite (build tool)

## License

MIT — see [LICENSE](./LICENSE) for details.

## Contributing

Contributions welcome! Open an issue or PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
