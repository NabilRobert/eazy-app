import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

/**
 * GET /api/decisions/[id]
 * Full detail of a single brain decision (scoped to the authed user).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  const decision = await prisma.decisionLog.findFirst({
    where: { id, userId: user.id }
  })

  if (!decision) {
    throw createError({ statusCode: 404, statusMessage: 'Decision not found' })
  }

  return { success: true, data: decision }
})
