import type { AuthMode, AuthForm } from '~/types/auth'

/** Login/register form logic: mode toggle, submit, session refresh, redirect. */
export function useLogin() {
  const { fetch: refreshSession } = useUserSession()

  const mode = ref<AuthMode>('login')
  const form = reactive<AuthForm>({ email: '', password: '' })
  const loading = ref(false)
  const error = ref('')

  function toggleMode() {
    mode.value = mode.value === 'login' ? 'register' : 'login'
    error.value = ''
  }

  async function handleSubmit() {
    loading.value = true
    error.value = ''
    try {
      const url = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
      await $fetch(url, { method: 'POST', body: { email: form.email, password: form.password } })
      await refreshSession()
      await navigateTo('/dashboard')
    } catch (err: any) {
      error.value = err.data?.statusMessage || err.data?.message || 'Something went wrong'
    } finally {
      loading.value = false
    }
  }

  return { mode, form, loading, error, toggleMode, handleSubmit }
}
