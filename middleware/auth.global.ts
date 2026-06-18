/**
 * Global auth gate. Unauthenticated users are sent to /login; authenticated
 * users hitting /login are sent to the dashboard. Uses nuxt-auth-utils'
 * useUserSession (works on both server and client render).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  const publicRoutes = ['/login']

  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }
  if (loggedIn.value && to.path === '/login') {
    return navigateTo('/dashboard')
  }
})
