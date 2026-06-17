import { requireAuth } from '~/server/utils/auth'
import { createAutomationService } from '~/server/services/automation.service'

/**
 * GET /api/automation/status
 * Current run state + quota counts. Polled by the dashboard every ~3s.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const service = createAutomationService(user.id)
  return service.getStatus()
})
