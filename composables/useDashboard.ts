import type { JobCard } from '~/types/job'

interface StatusResponse {
  running: boolean
  quota: { auto: number; confirmed: number; total: number }
}

/**
 * Dashboard logic: job catalogue, automation start/stop, status polling, and
 * logout. Owns its own lifecycle (mount fetch + poll cleanup) so the page is
 * purely presentational.
 */
export function useDashboard() {
  const { clear: clearSession } = useUserSession()

  const running = ref(false)
  const quota = reactive({ total: 0, auto: 0, confirmed: 0 })
  const jobs = ref<JobCard[]>([])
  const searchQuery = ref('')
  const filterStatus = ref('')
  const error = ref('')
  const loadError = ref('')
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const filteredJobs = computed(() =>
    jobs.value.filter((job) => {
      const matchesSearch =
        !searchQuery.value ||
        job.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        job.companyName.toLowerCase().includes(searchQuery.value.toLowerCase())
      const matchesStatus = !filterStatus.value || job.status === filterStatus.value
      return matchesSearch && matchesStatus
    })
  )

  async function fetchJobs() {
    try {
      const res = await $fetch<{ success: boolean; data: JobCard[] }>('/api/jobs')
      jobs.value = res.data || []
      loadError.value = ''
    } catch (e) {
      console.error('Failed to fetch jobs:', e)
      loadError.value = 'Could not load your jobs. Check your connection and refresh.'
    }
  }

  async function fetchStatus() {
    try {
      const s = await $fetch<StatusResponse>('/api/automation/status')
      running.value = s.running
      quota.total = s.quota.total
      quota.auto = s.quota.auto
      quota.confirmed = s.quota.confirmed
      if (!s.running) stopPolling()
    } catch (e) {
      console.error('Failed to fetch status:', e)
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
      await fetchStatus()
      await fetchJobs()
    }, 3000)
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function startAutomation() {
    error.value = ''
    try {
      await $fetch('/api/automation/start', { method: 'POST' })
      running.value = true
      startPolling()
    } catch (err: any) {
      error.value = err.data?.statusMessage || err.data?.message || 'Failed to start automation'
    }
  }

  async function stopAutomation() {
    try {
      await $fetch('/api/automation/stop', { method: 'POST' })
      running.value = false
      stopPolling()
      await fetchStatus()
      await fetchJobs()
    } catch (err: any) {
      console.error('Failed to stop automation:', err)
    }
  }

  function selectJob(job: JobCard) {
    if (job.jobUrl) window.open(job.jobUrl, '_blank')
  }

  async function logout() {
    await clearSession()
    await navigateTo('/login')
  }

  onMounted(async () => {
    await Promise.all([fetchJobs(), fetchStatus()])
    if (running.value) startPolling()
  })
  onUnmounted(stopPolling)

  return {
    running,
    quota,
    jobs,
    searchQuery,
    filterStatus,
    error,
    loadError,
    filteredJobs,
    startAutomation,
    stopAutomation,
    selectJob,
    logout
  }
}
