import { requireAuth } from '~/server/utils/auth'
import { AIService } from '~/server/services/ai.service'
import { validateBody } from '~/server/utils/validation'
import { aiCompanySchema } from '~/server/utils/schemas'

/**
 * POST /api/ai/company
 * Body: { company: string }. Returns a cached or freshly generated company
 * summary (Tavily research + the configured model), shared across users.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { company } = await validateBody(event, aiCompanySchema)

  const summary = await AIService.getCompanySummary(company)
  return { success: true, data: { summary } }
})
