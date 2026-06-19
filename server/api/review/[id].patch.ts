import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { validateBody } from '~/server/utils/validation'
import { reviewActionSchema } from '~/server/utils/schemas'

/**
 * PATCH /api/review/[id]
 * Body: { action: 'confirm' | 'skip', answers?: { [label]: value } }.
 * - skip:    mark the item skipped; the job will not be applied to.
 * - confirm: save the user's answers to the flagged questions and mark
 *            confirmed. The NEXT automation run applies it using those answers
 *            (using a reserved confirmed slot) — the worker performs the apply.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const { action, answers } = await validateBody(event, reviewActionSchema)

  const item = await prisma.reviewQueue.findFirst({ where: { id, userId: user.id } })
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Review item not found' })
  }
  if (item.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: `Already ${item.status}` })
  }

  if (action === 'skip') {
    await prisma.reviewQueue.update({
      where: { id: item.id },
      data: { status: 'skipped', resolvedAt: new Date() }
    })
    return { success: true, data: { status: 'skipped' } }
  }

  // confirm — store answers; the worker applies it on the next run.
  await prisma.reviewQueue.update({
    where: { id: item.id },
    data: { status: 'confirmed', answers: (answers ?? {}) as any }
  })
  return { success: true, data: { status: 'confirmed' } }
})
