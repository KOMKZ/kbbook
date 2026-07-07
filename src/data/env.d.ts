/**
 * Type declarations for Node built-in modules that are dynamically imported
 * at runtime (wrapped in try-catch). These are never actually loaded in the
 * browser — they fall back to browser APIs.
 */
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array
}
declare module 'node:module' {
  export function createRequire(url: string | URL): NodeRequire
}
declare module 'node:crypto' {
  export function createHash(algo: string): {
    update(data: string, encoding: string): { digest: (format: string) => string }
  }
}
