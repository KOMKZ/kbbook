# Series & Content Configuration

KBBook organizes content into **series** — independent collections of articles with their own navigation and landing pages.

## Registering a series

Edit `public/docs/series.json`:

```json
{
  "defaultSeries": "my-series",
  "series": [
    {
      "id": "my-series",
      "title": "My Series",
      "shortTitle": "My",
      "tagline": "What this series is about",
      "description": "A longer description for the series landing page",
      "version": "my-series-v0.1.0",
      "language": "zh-CN",
      "color": "#5046e5",
      "icon": "📚",
      "enabled": true
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier, used in URLs (`/docs/my-series`) |
| `version` | Points to the content directory (e.g., `my-series-v0.1.0`) |
| `language` | Content language code (`zh-CN`, `en`, etc.) |
| `color` | Theme color for the series card |
| `icon` | Emoji icon for the series |
| `enabled` | Set to `false` to hide from navigation |

## Creating content

Create a version directory under the language path:

```text
public/docs/zh-CN/my-series-v0.1.0/
├── _meta.json       ← Article directory
├── 01-intro.md      ← Your first article
├── 02-advanced.md   ← Your second article
└── ...
```

## The `_meta.json` file

This file defines the navigation structure for your series:

```json
{
  "title": "My Series",
  "items": [
    {
      "slug": "01-intro",
      "title": "Introduction",
      "order": 1,
      "isGroup": false
    },
    {
      "slug": "02-advanced",
      "title": "Advanced Topics",
      "order": 2,
      "isGroup": true,
      "items": [
        { "slug": "02-topic-a", "title": "Topic A", "order": 1 },
        { "slug": "02-topic-b", "title": "Topic B", "order": 2 }
      ]
    }
  ]
}
```

- **Flat articles**: Set `isGroup: false` for standalone articles
- **Grouped articles**: Set `isGroup: true` and nest `items` for collapsible sections

## Using the portal scripts

KBBook includes Python scripts to help manage series:

```bash
# Initialize a new series (creates directory + _meta.json + registers in series.json)
python3 scripts/portal/portal-series-init my-series \
  --title "My Series" \
  --icon "📚" \
  --color "#5046e5" \
  --tagline "A tagline for the series"

# Rebuild _meta.json from existing .md files
python3 scripts/portal/portal-meta-rebuild public/docs/zh-CN/my-series-v0.1.0

# Build a roadmap JSON for the series
python3 scripts/portal/portal-roadmap-rebuild public/docs/zh-CN/my-series-v0.1.0 \
  -o public/roadmap-my-series.json
```

## Version management

Edit `public/docs/versions.json` to add new versions:

```json
{
  "versions": [
    { "version": "0.1.0", "label": "v0.1.0", "path": "my-series-v0.1.0", "isLatest": false },
    { "version": "0.2.0", "label": "v0.2.0 (Latest)", "path": "my-series-v0.2.0", "isLatest": true }
  ],
  "defaultVersion": "my-series-v0.2.0",
  "supportedLanguages": ["zh-CN"],
  "defaultLanguage": "zh-CN"
}
```

→ **Next: [Markdown Writing Guide](./04-markdown-guide.md)** — Learn about KBBook's Markdown features.
