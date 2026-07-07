# Quick Start

Get KBBook running on your machine in 5 minutes.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (recommended) or npm

## Installation

```bash
# Clone the repository
git clone https://github.com/KOMKZ/kbbook.git
cd kbbook

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open `http://localhost:3004` in your browser. You should see the KBBook homepage with the "Getting Started" demo series.

## Project structure

```text
kbbook/
├── src/                  # React application source
│   ├── components/       # UI components
│   ├── pages/            # Route pages
│   ├── config/           # Site configuration
│   └── utils/            # Utility functions
├── public/
│   └── docs/             # ← YOUR CONTENT LIVES HERE
│       ├── series.json   # Series registry
│       ├── versions.json # Version config
│       └── zh-CN/        # Language directories
├── scripts/              # Build & management scripts
├── Makefile              # Dev, build, and deploy commands
└── package.json
```

## Essential commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server on port 3004 |
| `pnpm build` | Production build to `dist/` |
| `pnpm search:build` | Rebuild search index |
| `make help` | Show all available commands |

## Next steps

→ **Next: [Series & Content Configuration](./03-series-config.md)** — Learn how to add your own series and articles.
