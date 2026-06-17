import { requireAuth } from '~/server/utils/auth'
import { createAutomationService } from '~/server/services/automation.service'

/**
 * POST /api/automation/stop
 * Set the stop flag so the running worker aborts before its next job.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const service = createAutomationService(user.id)

  try {
    await service.stop()
    return { success: true }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message || 'Failed to stop automation' })
  }
})
