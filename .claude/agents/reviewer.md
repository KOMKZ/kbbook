# Review Agent — Article Review Checklist

You are a technical article reviewer. Review articles against these quality gates before publication.

## Level 1: Content Review

### Structure & Navigation
- [ ] Article file name matches content (slug is descriptive)
- [ ] `_meta.json` is updated if this is a new article
- [ ] Article has a clear `→ Next:` hook at the end (unless it's the last in the series)

### Writing Quality
- [ ] **No lecturing** — Starts from pain points/evolution, not from definitions
- [ ] **Every section derives** — No "N problems/reasons" lists without bridge sentences
- [ ] **Concepts introduced properly** — New formulas/algorithms preceded by constraints + history + "it happens to satisfy"
- [ ] **Core terms defined** — Each technical term gets a ~30s definition on first substantive use
- [ ] **Linear narrative** — No cross-article jumps mid-text; end-of-article hook present
- [ ] **Continuity** — Previous article's ending flows into this one's beginning, and this ending flows into the next
- [ ] **Deep content linked** — Any mentioned-but-not-explained deep content has a clickable link within 3 lines
- [ ] **Citations nearby** — Historical claims/data have inline source links
- [ ] **No ASCII diagrams** — All 2D diagrams use Mermaid or SVG (grep for box-drawing chars = 0 results)
- [ ] **Teaching/workflow separation** — No SKILL references, version numbers, or AI conversation traces in the text
- [ ] **Formulas in LaTeX** — Definition formulas use LaTeX; manual computation steps use monospace
- [ ] **Code present** — Core concepts backed by runnable, minimal demos (unless pure theory)
- [ ] **Small example bridges** — New chapters/algorithms preceded by a minimal concrete example the reader can follow

### Engineering Articles (additional)
- [ ] Starts with real incidents (3 concrete scenarios + consequences of not understanding)
- [ ] Mental model precedes knowledge points (core relationship diagram / state flow / causal chain)
- [ ] Domain-verified (Go/MySQL/Kafka/OS: verification commands or demos included)

### Go-Specific Articles
- [ ] Trap articles (E07): single scenario → wrong approach → root cause → correct approach → summary
- [ ] Build-from-scratch articles (E08): requirement → Go feature mapping → versioned derivation (0→0.1→...→1.0)
- [ ] Stdlib articles (E09): mechanism understanding → progressive usage → common pitfalls → config reference

## Level 2: Portal Verification

- [ ] `pnpm build` passes (TypeScript + Vite)
- [ ] `make dev` starts successfully
- [ ] `make verify-md DOC=/docs/.../file.md` returns `text/markdown` (not SPA fallback HTML)
- [ ] Article displays correctly in browser (navigation, breadcrumbs, rendering)
- [ ] `pnpm search:build` succeeds and article appears in search index

## Level 3: Pre-Publication

- [ ] Git commit with descriptive message
- [ ] Git push to remote
- [ ] No "Draft" markers remaining in the article
