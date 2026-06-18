<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <div class="flex gap-4">
            <NuxtLink to="/review" class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200">
              Review Queue
            </NuxtLink>
            <NuxtLink to="/decisions" class="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200">
              Thought Process
            </NuxtLink>
            <NuxtLink to="/settings" class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
              Settings
            </NuxtLink>
            <button @click="logout" class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <!-- Automation Control -->
      <div class="rounded-lg bg-white p-6 shadow mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold">Automation</h2>
            <p class="text-gray-600 mt-1">Status: <span :class="{ 'text-green-600': running, 'text-gray-600': !running }">
              {{ running ? 'Running' : 'Stopped' }}
            </span></p>
          </div>
          <div class="space-x-3">
            <button
              @click="startAutomation"
              :disabled="running"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Start
            </button>
            <button
              @click="stopAutomation"
              :disabled="!running"
              class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </div>
        <p v-if="error" class="text-red-600 text-sm mt-3">{{ error }}</p>
      </div>

      <!-- Quota Bar -->
      <div class="rounded-lg bg-white p-6 shadow mb-6">
        <h3 class="text-lg font-semibold mb-4">Daily Quota</h3>
        <div class="space-y-3">
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">Applications Today</span>
              <span class="text-sm font-medium text-gray-700">{{ quota.total }} / 30</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full"
                :style="{ width: `${(quota.total / 30) * 100}%` }"
              ></div>
            </div>
          </div>
          <p class="text-sm text-gray-600">
            Auto: {{ quota.auto }} | Confirmed: {{ quota.confirmed }}
          </p>
        </div>
      </div>

      <!-- Job Catalogue -->
      <div class="rounded-lg bg-white p-6 shadow">
        <div class="mb-6">
          <h2 class="text-2xl font-bold mb-4">Job Applications</h2>
          <div class="flex gap-3">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by title or company..."
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select v-model="filterStatus" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">All Statuses</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <!-- Jobs Grid -->
        <div v-if="jobs.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="job in filteredJobs"
            :key="job.id"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-lg cursor-pointer"
            @click="selectJob(job)"
          >
            <h3 class="font-semibold text-lg truncate">{{ job.title }}</h3>
            <p class="text-gray-600 truncate">{{ job.companyName }}</p>
            <p class="text-sm text-gray-500 mt-2">{{ job.location }}</p>
            <div class="mt-4 flex justify-between items-center">
              <span :class="{
                'px-3 py-1 rounded-full text-sm font-medium': true,
                'bg-blue-100 text-blue-800': job.status === 'applied',
                'bg-yellow-100 text-yellow-800': job.status === 'interview',
                'bg-green-100 text-green-800': job.status === 'offer',
                'bg-red-100 text-red-800': job.status === 'rejected'
              }">
                {{ job.status }}
              </span>
              <span v-if="job.salaryMin" class="text-sm font-medium">
                ${{ job.salaryMin / 1000 }}k
              </span>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-12 text-gray-500">
          No jobs yet. Start automation to begin applying!
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
interface Job {
  id: string
  title: string
  companyName: string
  location: string
  status: string
  salaryMin?: number
  jobUrl?: string
}

const { clear: clearSession } = useUserSession()

const running = ref(false)
const quota = reactive({ total: 0, auto: 0, confirmed: 0 })
const jobs = ref<Job[]>([])
const searchQuery = ref('')
const filterStatus = ref('')
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const filteredJobs = computed(() => {
  return jobs.value.filter(job => {
    const matchesSearch = !searchQuery.value ||
      job.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesStatus = !filterStatus.value || job.status === filterStatus.value

    return matchesSearch && matchesStatus
  })
})

async function fetchJobs() {
  try {
    const res = await $fetch<{ success: boolean; data: Job[] }>('/api/jobs')
    jobs.value = res.data || []
  } catch (e) {
    console.error('Failed to fetch jobs:', e)
  }
}

async function fetchStatus() {
  try {
    const s = await $fetch<{ running: boolean; quota: { auto: number; confirmed: number; total: number } }>(
      '/api/automation/status'
    )
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

function selectJob(job: Job) {
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
</script>
