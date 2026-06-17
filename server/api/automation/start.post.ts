import { requireAuth } from '~/server/utils/auth'
import { createAutomationService } from '~/server/services/automation.service'

/**
 * POST /api/automation/start
 * Validate preconditions (profile, LinkedIn auth, targeting) and kick off the
 * worker loop in the background. Returns immediately; the client polls /status.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const service = createAutomationService(user.id)

  try {
    await service.start()
    const status = await service.getStatus()
    return { success: true, status }
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || 'Failed to start automation' })
  }
})
