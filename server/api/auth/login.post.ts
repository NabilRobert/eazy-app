import prisma from '~/server/utils/prisma'
import { verifyPassword } from '~/server/utils/password'

/**
 * POST /api/auth/login
 * Body: { email, password }. Verifies credentials and starts a session.
 */
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email?: string; password?: string }>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  // Same error for missing user vs bad password (avoid leaking which emails exist).
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, { user: { id: user.id, email: user.email } })
  return { success: true, user: { id: user.id, email: user.email } }
})
