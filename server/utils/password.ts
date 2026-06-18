import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing with Node's built-in scrypt (no native deps).
 * Stored format: `salt:hash` (both hex). 16-byte salt, 64-byte derived key.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(plain, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
