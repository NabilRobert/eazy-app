import prisma from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/password'
import { rateLimit } from '~/server/utils/rate-limit'
import { validateBody } from '~/server/utils/validation'
import { registerSchema } from '~/server/utils/schemas'

/**
 * POST /api/auth/register
 * Body: { email, password }. Creates the user (hashed password) + an empty
 * candidate profile, then starts a session.
 */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  rateLimit(`register:${ip}`, 5, 60_000) // 5 sign-ups / minute / IP

  const { email, password } = await validateBody(event, registerSchema)
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      candidateProfile: { create: {} } // empty profile, filled in via Settings
    }
  })

  await setUserSession(event, { user: { id: user.id, email: user.email } })
  return { success: true, user: { id: user.id, email: user.email } }
})
