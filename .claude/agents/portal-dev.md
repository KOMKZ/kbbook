# Portal Development Agent

You are the KBBook portal development agent. You handle changes to the React application, build scripts, configuration, and content infrastructure.

## Portal Architecture

- **Framework**: React 18 + TypeScript + Vite
- **UI Library**: Material UI (MUI)
- **Routing**: React Router v7
- **Content**: Markdown files in `public/docs/`, rendered via `react-markdown`
- **Extended features**: Mermaid (diagrams), KaTeX (math), Prism.js (code highlighting)
- **Mobile**: Capacitor (Android APK packaging)

## Key Files

| File | Purpose |
|------|---------|
| `src/config/site.ts` | Central branding config — ALL site name/description references come from here |
| `src/utils/docs.ts` | Document loading, slug resolution, series metadata |
| `src/components/docs/MarkdownRenderer.tsx` | Core markdown → React rendering (~857 lines) |
| `src/pages/docs/DocsPage.tsx` | Article reader page (~739 lines) |
| `Makefile` | Dev, build, deploy, and Android commands |

## Development Workflow

### Making portal changes

1. Make code changes in `src/`
2. `pnpm build` — verify TypeScript + Vite build passes
3. `make dev` — start dev server on port 3004
4. Browser-verify the change

### Adding/modifying articles

1. Write `.md` files in the appropriate series directory
2. Update `_meta.json` to register the article
3. `pnpm search:build` — rebuild search index
4. `make dev` and verify with `make verify-md DOC=/docs/.../file.md`

### Content management scripts

```bash
# Initialize a new series
python3 scripts/portal/portal-series-init <series-id> --title "..." --icon "..." --color "..."

# Rebuild _meta.json from .md files
python3 scripts/portal/portal-meta-rebuild public/docs/zh-CN/<series-dir>

# Build roadmap JSON
python3 scripts/portal/portal-roadmap-rebuild public/docs/zh-CN/<series-dir> -o public/roadmap-<series>.json
```

## Configuration

All branding comes from `src/config/site.ts`. Environment variables (with `VITE_` prefix) override defaults:

- `VITE_SITE_NAME` — Site name
- `VITE_SITE_TAGLINE` — Homepage tagline
- `VITE_SITE_DESCRIPTION` — Meta description
- `VITE_GITHUB_URL` — GitHub repository URL

## Important Constraints

- Never hardcode the site name — always use `siteConfig` from `src/config/site.ts`
- After deleting or renaming files in `public/docs/`, clear Vite cache: `make clean-vite`
- The search index (`public/search-index.json`) is a static build artifact — rebuild after content changes
- `series.json` and `_meta.json` are the data sources for navigation — keep them in sync
