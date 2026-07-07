# KBBook

> **Your knowledge, in book form. Write with AI. Read anywhere. Sync via cloud.**

&#x1F1E8;&#x1F1F3; [&#x4E2D;&#x6587;](./README.zh-CN.md)

KBBook turns the Markdown articles you write with AI into a beautiful, searchable knowledge base with Mermaid diagrams, KaTeX math, and code highlighting — packaged as an Android app for offline reading, with OSS cloud sync.

---

## &#x2728; Why KBBook?

| Your Problem | KBBook Solution |
|-------------|-----------------|
| AI-written articles scattered everywhere | **Multi-series organization** — auto-generated navigation by topic |
| Want to read on tablet, offline | **Android App** — one command to build & install APK |
| Updated articles, tablet still shows old | **OSS Cloud Sync** — push once, all devices auto-update |
| Technical articles look boring | **Mermaid + KaTeX** — diagrams, flowcharts, math rendered natively |
| Can't find that one article | **Full-text search** — offline static index, instant results |
| Don't want a backend or database | **Zero runtime deps** — pure static files, deploy anywhere |

## &#x26A1; Quick Start

```bash
git clone https://github.com/KOMKZ/kbbook.git
cd kbbook
pnpm install && pnpm dev
```

Open `http://localhost:3004`. Done.

## &#x1F4D6; Write with AI

KBBook's biggest differentiator: **built-in AI writing agents and templates**.

1. Chat with Claude / ChatGPT / any AI tool to draft articles
2. Save as `.md` files into `public/docs/`
3. Update `_meta.json` to register in navigation
4. Refresh — your article is live in the book

### &#x1F9E0; Built-in AI Agents (`.claude/agents/`)

| Agent | What it does |
|-------|-------------|
| `writer.md` | Teaches AI derivation-style technical writing — start from pain points, not definitions |
| `reviewer.md` | Article quality checklist — structure, citations, diagrams, code demos |
| `portal-dev.md` | Portal development conventions — components, config, build scripts |

### &#x1F4DD; Writing Templates (`.claude/templates/`)

**15 ready-to-use article structures.** Tell AI "use the derivation template" and it knows exactly how to organize your article.

| Template | For |
|----------|-----|
| `E06-derivation-writing-mode.md` | Teaching a mechanism from first principles |
| `derivation-mode.md` | Lightweight derivation pattern |
| `engineering-deep-dive.md` | Backend / systems / middleware deep dives |
| `ops-diagnosis-mode.md` | OS / MySQL / Kafka troubleshooting |
| `algorithm-engineering-mode.md` | Brute force &#x2192; optimize &#x2192; benchmark |
| `T04-hands-on-walkthrough.md` | Step-by-step manual calculation |
| `T05-action-plan-table-mode.md` | Action plans and how-to guides |
| `T06-practical-research-mode.md` | Industry analysis and research |
| `E07-go-trap-mode.md` | Go language pitfalls |
| `E08-go-build-from-scratch.md` | Building Go components from scratch |
| `E09-go-stdlib-deep-dive.md` | Go standard library deep usage |
| `go-runtime-deep-dive.md` | Go runtime / GC / scheduler |
| `go-design-pattern-mode.md` | Go design patterns |
| `code-demo-mode.md` | Runnable code with evolution versions |
| `survey-mode.md` | Multi-solution comparison and selection |

> &#x1F4CC; Templates are the **canonical source** maintained separately and synced into KBBook periodically. They encode years of technical writing experience into reusable prompts. Give them to any AI.

## &#x1F4F1; Offline Android App

```bash
make verify-app
```

One command: build APK → verify content → install to tablet → launch. Full offline support — Mermaid diagrams, KaTeX formulas, code blocks all render perfectly without internet.

## &#x2601;&#xFE0F; OSS Cloud Sync

```bash
make upload-to-oss
```

Push updated articles to Alibaba Cloud OSS. The tablet app auto-detects new content and downloads it. No need to rebuild or reinstall the APK — readers always see the latest version.

## &#x1F50D; Health Check

```bash
bash scripts/check.sh
```

Verifies: environment → dependencies → content → build → security scan. Run once after clone.

## &#x1F4E6; Your content, your way

```text
public/docs/
├── series.json           # Register your series
├── versions.json         # Version config
└── zh-CN/
    └── my-series-v0.1.0/
        ├── _meta.json    # Navigation
        ├── 01-intro.md
        └── 02-advanced.md
```

That's all you need to touch. Write articles, update the directory, sync. KBBook handles everything else.

## &#x1F9B0; Tech Stack

React 18 + TypeScript + Material UI + Vite + Capacitor (Android). MIT License.
