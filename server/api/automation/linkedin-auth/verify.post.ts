import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { encryptSessionCookie } from '~/server/utils/encrypt'
import { getPendingAuth, clearPendingAuth } from '~/server/utils/linkedin-session-store'
import type { LinkedinAuthVerifyRequest, LinkedinAuthResponse } from '~/types/automation'

/**
 * POST /api/automation/linkedin-auth/verify
 * Submit the 2FA code on the live Steel session started by /linkedin-auth.
 * On success the session cookie is encrypted and stored; a rejected code keeps
 * the handshake open so the user can retry.
 */
export default defineEventHandler(async (event): Promise<LinkedinAuthResponse> => {
  const user = await requireAuth(event)
  const { code } = await readBody<LinkedinAuthVerifyRequest>(event)

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Verification code is required' })
  }

  const service = getPendingAuth(user.id)
  if (!service) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No pending LinkedIn verification. Please start the login again.'
    })
  }

  try {
    const result = await service.submit2FACode(code)

    if (result.status === 'authenticated') {
      const enc = encryptSessionCookie({ cookies: result.cookies ?? [] })
      await prisma.candidateProfile.update({
        where: { userId: user.id },
        data: { linkedinAuthStatus: 'authenticated', sessionCookieEnc: enc }
      })
      await service.closeSession()
      clearPendingAuth(user.id)
      return { status: 'authenticated', message: 'LinkedIn connected successfully' }
    }

    if (result.status === 'pending_2fa') {
      // Code rejected — keep the session open for another attempt.
      return { status: 'pending_2fa', message: result.message ?? 'Incorrect code. Please try again.' }
    }

    // Hard failure — tear down.
    await service.closeSession()
    clearPendingAuth(user.id)
    await prisma.candidateProfile.update({
      where: { userId: user.id },
      data: { linkedinAuthStatus: 'expired' }
    }).catch(() => {})
    return { status: 'error', message: result.message ?? '2FA verification failed' }
  } catch (err: any) {
    await service.closeSession().catch(() => {})
    clearPendingAuth(user.id)
    throw createError({ statusCode: 500, statusMessage: err.message || '2FA verification failed' })
  }
})
