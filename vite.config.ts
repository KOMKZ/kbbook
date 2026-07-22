import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION_CODE__: JSON.stringify(process.env.VITE_VERSION_CODE || 'dev'),
    __OSS_ENDPOINT__: JSON.stringify(process.env.VITE_OSS_ENDPOINT || ''),
    __OSS_BUCKET__: JSON.stringify(process.env.VITE_OSS_BUCKET || ''),
    __OSS_PATH__: JSON.stringify(process.env.VITE_OSS_PATH || ''),
    __OSS_ACCESS_KEY_ID__: JSON.stringify(process.env.VITE_OSS_ACCESS_KEY_ID || ''),
    __OSS_ACCESS_KEY_SECRET__: JSON.stringify(process.env.VITE_OSS_ACCESS_KEY_SECRET || ''),
    __NETWORK_URL__: JSON.stringify(process.env.VITE_NETWORK_URL || 'http://localhost:3004'),
    __GIT_HASH__: JSON.stringify(process.env.VITE_GIT_HASH || "unknown"),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Exclude mermaid from Vite dependency pre-bundling to prevent
  // 504 (Outdated Optimize Dep) errors caused by stale pre-bundle cache.
  // Mermaid ships proper ESM (.mjs) and internally lazy-loads 29 diagram
  // type modules via dynamic import(). When Vite pre-bundles these, the
  // hashed chunk filenames can become stale after cache clears/package
  // updates, causing mermaid render to fail. Serving mermaid as native
  // ESM avoids the pre-bundle cache entirely.
  optimizeDeps: {
    exclude: ['mermaid'],
  },
  server: {
    host: '0.0.0.0',
    port: 3004,
  },
})
