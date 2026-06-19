import { requireAuth } from '~/server/utils/auth'
import { AIService } from '~/server/services/ai.service'
import { validateBody } from '~/server/utils/validation'
import { aiSalarySchema } from '~/server/utils/schemas'

/**
 * POST /api/ai/salary
 * Body: { description: string }. Returns { min, max, currency } parsed strictly
 * from the description (nulls if salary is not explicitly stated).
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { description } = await validateBody(event, aiSalarySchema)

  const salary = await AIService.parseSalary(description)
  return { success: true, data: salary }
})
