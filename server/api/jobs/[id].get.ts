import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

/**
 * GET /api/jobs/[id]
 * Single job card, including the cached company summary (if any).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  const job = await prisma.job.findFirst({
    where: { id, userId: user.id },
    include: { company: true }
  })

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  return { success: true, data: job }
})
