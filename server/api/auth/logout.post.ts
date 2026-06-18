/**
 * POST /api/auth/logout
 * Clears the current session.
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { success: true }
})
