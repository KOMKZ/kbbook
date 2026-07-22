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
  // Ensure Vite pre-bundles mermaid eagerly. Mermaid lazy-loads 29 diagram
  // type modules via internal dynamic import(). Combined with --force flag
  // on dev server startup, this guarantees a fresh pre-bundle with all
  // dynamic imports discovered, preventing 504 (Outdated Optimize Dep)
  // errors from stale hashed chunks.
  optimizeDeps: {
    include: ['mermaid'],
  },
  server: {
    host: '0.0.0.0',
    port: 3004,
  },
})
