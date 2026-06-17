import { requireAuth } from '~/server/utils/auth'
import { AIService } from '~/server/services/ai.service'

/**
 * POST /api/ai/salary
 * Body: { description: string }. Returns { min, max, currency } parsed strictly
 * from the description (nulls if salary is not explicitly stated).
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { description } = await readBody<{ description?: string }>(event)

  if (!description) {
    throw createError({ statusCode: 400, statusMessage: 'description is required' })
  }

  const salary = await AIService.parseSalary(description)
  return { success: true, data: salary }
})
