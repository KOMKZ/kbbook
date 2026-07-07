# Build & Deployment

## Production build

```bash
# TypeScript check + Vite production build
pnpm build

# Output is in dist/ — ready to deploy
ls dist/
# index.html  assets/  docs/  images/  vite.svg
```

## Build the search index

After adding or modifying articles, rebuild the search index:

```bash
pnpm search:build
```

This scans all enabled series and generates `public/search-index.json`. Verify:

```bash
grep "your-article-slug" public/search-index.json
```

## Hosting options

### Static hosting (recommended)

The `dist/` directory is pure static files. Deploy to:

- **GitHub Pages** — `git push` to `gh-pages` branch
- **Netlify** — Point to the repo, build command: `pnpm build`, publish directory: `dist`
- **Vercel** — Import repo, it auto-detects Vite
- **Nginx** — Copy `dist/` to your server
- **Any static file server** — `npx serve dist`

### Nginx example

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/kbbook/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## OSS deployment (optional)

KBBook's Makefile includes targets for Alibaba Cloud OSS deployment:

```bash
# Set your OSS credentials
export OSS_BUCKET=my-bucket
export OSS_PATH=kbbook-data

# Upload docs to OSS (MD5 incremental — only changed files)
make upload-to-oss
```

> **Note**: Requires `ossutil` CLI tool installed and configured.

## Android APK (optional)

KBBook includes Capacitor support for building Android APKs:

```bash
# Full pipeline: build + APK + install to connected device
make release
```

## Configuration

Edit `src/config/site.ts` to customize branding:

```typescript
export const siteConfig: SiteConfig = {
  name: 'My Docs',
  shortName: 'Docs',
  tagline: 'Your Knowledge Base',
  description: 'A documentation portal',
  footer: 'Powered by KBBook',
  githubUrl: 'https://github.com/your-org/your-repo',
  logo: { text: 'MD' },
}
```

Or use environment variables:

```bash
VITE_SITE_NAME="My Docs" pnpm dev
```

---

That's it! You now know everything needed to use KBBook. Start writing your first series, and happy documenting!
