import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

const STATUSES = ['applied', 'interview', 'offer', 'rejected', 'withdrawn']

/**
 * GET /api/jobs
 * List the user's job cards (most recent first). Optional query params:
 *   ?status=applied|interview|offer|rejected|withdrawn
 *   ?company=<substring>   ?keyword=<title substring>
 *   ?start=<ISO date>      ?end=<ISO date>   (applied date range)
 *   ?limit=N (default 200)
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const q = getQuery(event)

  const where: Record<string, any> = { userId: user.id }
  if (typeof q.status === 'string' && STATUSES.includes(q.status)) where.status = q.status
  if (typeof q.company === 'string' && q.company) where.companyName = { contains: q.company, mode: 'insensitive' }
  if (typeof q.keyword === 'string' && q.keyword) where.title = { contains: q.keyword, mode: 'insensitive' }
  if (q.start || q.end) {
    where.appliedAt = {}
    if (q.start) where.appliedAt.gte = new Date(String(q.start))
    if (q.end) where.appliedAt.lte = new Date(String(q.end))
  }

  const limit = Math.min(Number(q.limit) || 200, 1000)
  const jobs = await prisma.job.findMany({
    where,
    orderBy: { appliedAt: 'desc' },
    take: limit
  })

  return { success: true, data: jobs }
})
