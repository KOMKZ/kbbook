/**
 * SHA-256 checksum — uses Web Crypto API in browser, Node crypto in Node.
 */

let nodeCrypto: any = null

async function getNodeCrypto() {
  if (!nodeCrypto) {
    try { nodeCrypto = await import('node:crypto') } catch { nodeCrypto = false }
  }
  return nodeCrypto === false ? null : nodeCrypto
}

export async function sha256(data: string): Promise<string> {
  // Try Web Crypto API first
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder()
    const hash = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback to Node crypto
  const nc = await getNodeCrypto()
  if (nc) {
    return nc.createHash('sha256').update(data, 'utf-8').digest('hex')
  }

  // Last resort — simple hash (NOT cryptographically secure, for testing only)
  let h = 0
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) - h + data.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16).padStart(8, '0')
}

export async function verifyChecksum(data: string, expected: string): Promise<boolean> {
  const actual = await sha256(data)
  return actual === expected
}
