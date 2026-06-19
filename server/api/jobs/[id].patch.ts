import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { validateBody } from '~/server/utils/validation'
import { jobStatusSchema } from '~/server/utils/schemas'

/**
 * PATCH /api/jobs/[id]
 * Body: { status }. Manually update a job's application status.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const { status } = await validateBody(event, jobStatusSchema)

  // Scope the update to the owner.
  const existing = await prisma.job.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Job not found' })
  }

  const job = await prisma.job.update({ where: { id: existing.id }, data: { status } })
  return { success: true, data: job }
})
