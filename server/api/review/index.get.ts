import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

/**
 * GET /api/review
 * List pending review-queue items (jobs the brain flagged for confirmation),
 * newest first, with their job details.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const items = await prisma.reviewQueue.findMany({
    where: { userId: user.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    include: { job: true }
  })

  // Flatten to what the inbox UI needs.
  const data = items.map((it) => ({
    id: it.id,
    reason: it.reason,
    questions: Array.isArray(it.questions) ? (it.questions as string[]) : [],
    createdAt: it.createdAt,
    jobId: it.jobId,
    title: it.job?.title ?? '',
    company: it.job?.companyName ?? '',
    location: it.job?.location ?? '',
    description: it.job?.description ?? '',
    jobUrl: it.job?.jobUrl ?? ''
  }))

  return { success: true, data }
})
