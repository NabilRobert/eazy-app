import prisma from '~/server/utils/prisma'
import { verifyPassword } from '~/server/utils/password'
import { rateLimit } from '~/server/utils/rate-limit'
import { validateBody } from '~/server/utils/validation'
import { loginSchema } from '~/server/utils/schemas'

/**
 * POST /api/auth/login
 * Body: { email, password }. Verifies credentials and starts a session.
 */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  rateLimit(`login:${ip}`, 10, 60_000) // 10 attempts / minute / IP

  const { email, password } = await validateBody(event, loginSchema)

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  // Same error for missing user vs bad password (avoid leaking which emails exist).
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, { user: { id: user.id, email: user.email } })
  return { success: true, user: { id: user.id, email: user.email } }
})
