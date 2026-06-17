import type { LinkedinService } from '~/server/services/linkedin.service'

/**
 * In-memory registry of LinkedIn auth handshakes in progress.
 *
 * The login -> 2FA flow spans two HTTP requests but must drive the SAME live
 * Steel browser (the page is sitting on the 2FA challenge). We keep the active
 * LinkedinService instance here, keyed by userId, between those requests.
 *
 * NOTE: this is process-local. It is correct for single-server / dev (V1).
 * For a multi-instance serverless deploy, persist the Steel sessionId instead
 * and have submit2FACode reconnect via CDP to the existing browser context.
 */
interface PendingAuth {
  service: LinkedinService
  createdAt: number
}

const TTL_MS = 5 * 60 * 1000 // abandon a half-finished handshake after 5 min
const store = new Map<string, PendingAuth>()

/** Drop and release any handshake older than the TTL. */
function sweep() {
  const now = Date.now()
  for (const [userId, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      entry.service.closeSession().catch(() => {})
      store.delete(userId)
    }
  }
}

export function setPendingAuth(userId: string, service: LinkedinService) {
  sweep()
  // Replace any prior handshake for this user.
  const existing = store.get(userId)
  if (existing) existing.service.closeSession().catch(() => {})
  store.set(userId, { service, createdAt: Date.now() })
}

export function getPendingAuth(userId: string): LinkedinService | undefined {
  sweep()
  return store.get(userId)?.service
}

export function clearPendingAuth(userId: string) {
  store.delete(userId)
}
