/**
 * Minimal in-memory sliding-window rate limiter. Throws 429 when the key
 * exceeds `limit` hits within `windowMs`.
 *
 * NOTE: process-local — correct for single-server/dev. For multi-instance,
 * back this with Redis or a shared store.
 */
const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again shortly.' })
  }
  recent.push(now)
  hits.set(key, recent)
}
