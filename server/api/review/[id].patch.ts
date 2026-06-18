import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { QuotaService } from '~/server/services/quota.service'

/**
 * PATCH /api/review/[id]
 * Body: { action: 'confirm' | 'skip' }.
 * - skip:    mark the item skipped; the job will not be applied to.
 * - confirm: mark confirmed, reserve a confirmed-apply slot, clear the job's
 *            needsReview flag so it leaves the queue.
 *
 * NOTE: confirming records the user's intent and reserves the slot. The actual
 * Playwright re-apply for a confirmed job is a follow-up (needs a single-job
 * apply extracted from the worker) — see docs/brain.md / plan.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const { action } = await readBody<{ action?: string }>(event)

  if (action !== 'confirm' && action !== 'skip') {
    throw createError({ statusCode: 400, statusMessage: "action must be 'confirm' or 'skip'" })
  }

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

  // confirm
  await prisma.reviewQueue.update({
    where: { id: item.id },
    data: { status: 'confirmed', resolvedAt: new Date() }
  })
  await prisma.job.update({ where: { id: item.jobId }, data: { needsReview: false } })
  await QuotaService.incrementConfirmedApplied(user.id)

  return { success: true, data: { status: 'confirmed' } }
})
