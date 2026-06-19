import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

/**
 * GET /api/decisions
 * List the brain's decisions (most recent first). Optional query params:
 *   ?decision=apply|review|skip   filter by verdict
 *   ?limit=N                      max rows (default 100)
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const q = getQuery(event)

  const where: Record<string, any> = { userId: user.id }
  if (q.decision === 'apply' || q.decision === 'review' || q.decision === 'skip') {
    where.decision = q.decision
  }
  const limit = Math.min(Number(q.limit) || 50, 200)
  const offset = Math.max(0, Number(q.offset) || 0)

  const decisions = await prisma.decisionLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  })

  return { success: true, data: decisions }
})
