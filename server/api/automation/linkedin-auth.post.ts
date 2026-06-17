import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { encryptSessionCookie } from '~/server/utils/encrypt'
import { createLinkedinService } from '~/server/services/linkedin.service'
import { setPendingAuth, clearPendingAuth } from '~/server/utils/linkedin-session-store'
import type { LinkedinAuthRequest, LinkedinAuthResponse } from '~/types/automation'

/**
 * POST /api/automation/linkedin-auth
 * Initiate a LinkedIn login via Steel + Playwright. The password is used only
 * to fill the login form and is never persisted. On success the session cookie
 * is AES-256 encrypted and stored; on a 2FA challenge the live Steel session is
 * held in the in-memory store for the follow-up /verify call.
 */
export default defineEventHandler(async (event): Promise<LinkedinAuthResponse> => {
  const user = await requireAuth(event)
  const { email, password } = await readBody<LinkedinAuthRequest>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'LinkedIn email and password are required' })
  }

  const config = useRuntimeConfig()
  if (!config.steel_api_key) {
    throw createError({ statusCode: 500, statusMessage: 'STEEL_API_KEY is not configured' })
  }

  const service = createLinkedinService(config.steel_api_key)

  try {
    const result = await service.login(email, password)

    if (result.status === 'pending_2fa') {
      // Keep the browser alive for the verify step.
      setPendingAuth(user.id, service)
      await persistAuthState(user.id, email, 'pending_2fa', null)
      return { status: 'pending_2fa', message: 'LinkedIn sent a verification code. Enter it to continue.' }
    }

    if (result.status === 'authenticated') {
      const enc = encryptSessionCookie({ cookies: result.cookies ?? [] })
      await persistAuthState(user.id, email, 'authenticated', enc)
      await service.closeSession()
      return { status: 'authenticated', message: 'LinkedIn connected successfully' }
    }

    // Error path — release the browser, leave status expired.
    await service.closeSession()
    return { status: 'error', message: result.message ?? 'LinkedIn login failed' }
  } catch (err: any) {
    clearPendingAuth(user.id)
    await service.closeSession().catch(() => {})
    throw createError({ statusCode: 500, statusMessage: err.message || 'LinkedIn login failed' })
  }
})

/** Upsert the candidate profile's LinkedIn auth fields. */
async function persistAuthState(
  userId: string,
  linkedinEmail: string,
  status: string,
  sessionCookieEnc: string | null
) {
  await prisma.candidateProfile.upsert({
    where: { userId },
    create: { userId, linkedinEmail, linkedinAuthStatus: status, sessionCookieEnc },
    update: { linkedinEmail, linkedinAuthStatus: status, sessionCookieEnc }
  })
}
