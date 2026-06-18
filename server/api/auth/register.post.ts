import prisma from '~/server/utils/prisma'
import { hashPassword } from '~/server/utils/password'

/**
 * POST /api/auth/register
 * Body: { email, password }. Creates the user (hashed password) + an empty
 * candidate profile, then starts a session.
 */
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email?: string; password?: string }>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

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
