import { requireAuth } from '~/server/utils/auth'
import { AIService } from '~/server/services/ai.service'

/**
 * POST /api/ai/company
 * Body: { company: string }. Returns a cached or freshly generated company
 * summary (Tavily research + gpt-4o-mini), shared across users.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { company } = await readBody<{ company?: string }>(event)

  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'company is required' })
  }

  const summary = await AIService.getCompanySummary(company)
  return { success: true, data: { summary } }
})
