/**
 * CSRF defense: reject state-changing requests whose Origin doesn't match the
 * host. Browsers always send Origin on cross-origin (and same-origin) fetch, so
 * a malicious site can't forge an authenticated POST. Same-origin app calls and
 * server-side requests (no Origin) pass through.
 */
export default defineEventHandler((event) => {
  const method = event.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return

  const origin = getHeader(event, 'origin')
  if (!origin) return // non-browser / server-side / same-origin navigation

  const host = getHeader(event, 'host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
  if (originHost !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
  }
})
