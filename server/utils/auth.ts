/**
 * Auth helper built on nuxt-auth-utils sealed sessions.
 *
 * The module auto-imports setUserSession / getUserSession / requireUserSession
 * / clearUserSession into the server context, so we don't redefine those here
 * (doing so would collide with the auto-imports). `requireAuth` is a thin
 * wrapper that returns the authenticated user object so routes can use
 * `const user = await requireAuth(event); user.id`.
 */
export interface SessionUser {
  id: string
  email: string
}

/** Require an authenticated session; throws 401 otherwise. Returns the user. */
export async function requireAuth(event: any): Promise<SessionUser> {
  const session = await requireUserSession(event)
  return session.user as SessionUser
}
