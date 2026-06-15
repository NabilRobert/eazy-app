<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">Review Queue</h1>
          <NuxtLink to="/dashboard" class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
            Back to Dashboard
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Panel: Review List -->
        <div class="lg:col-span-1">
          <div class="rounded-lg bg-white shadow p-4 space-y-3">
            <h2 class="text-lg font-semibold">Pending Review</h2>

            <div v-if="pendingJobs.length" class="space-y-2">
              <div
                v-for="job in pendingJobs"
                :key="job.id"
                @click="selectJob(job)"
                :class="{
                  'p-3 border-l-4 cursor-pointer hover:bg-gray-50': true,
                  'border-blue-600 bg-blue-50': selectedJob?.id === job.id,
                  'border-gray-300': selectedJob?.id !== job.id
                }"
              >
                <h3 class="font-medium text-sm">{{ job.title }}</h3>
                <p class="text-xs text-gray-600">{{ job.company }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ job.reason }}</p>
              </div>
            </div>

            <div v-else class="text-center py-8 text-gray-500">
              No pending reviews
            </div>
          </div>
        </div>

        <!-- Right Panel: Detail View -->
        <div class="lg:col-span-2">
          <div v-if="selectedJob" class="rounded-lg bg-white shadow p-6">
            <h2 class="text-2xl font-bold mb-2">{{ selectedJob.title }}</h2>
            <p class="text-lg text-gray-600 mb-4">{{ selectedJob.company }}</p>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p class="text-sm font-medium text-yellow-800">
                {{ selectedJob.reason }}
              </p>
            </div>

            <div class="prose prose-sm max-w-none mb-6">
              <p v-if="selectedJob.description" class="text-gray-700">{{ selectedJob.description }}</p>
            </div>

            <div class="flex gap-3">
              <button
                @click="confirmJob"
                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirm & Apply
              </button>
              <button
                @click="skipJob"
                class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Skip
              </button>
            </div>
          </div>

          <div v-else class="rounded-lg bg-white shadow p-6 text-center text-gray-500">
            Select a job to review
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
interface ReviewJob {
  id: string
  title: string
  company: string
  reason: string
  description?: string
  status: string
}

const pendingJobs = ref<ReviewJob[]>([])
const selectedJob = ref<ReviewJob | null>(null)

async function selectJob(job: ReviewJob) {
  selectedJob.value = job
  // TODO: Fetch full job details if needed
}

async function confirmJob() {
  if (!selectedJob.value) return

  try {
    // TODO: Call PATCH /api/review/[id] with status='confirmed'
    pendingJobs.value = pendingJobs.value.filter(j => j.id !== selectedJob.value!.id)
    selectedJob.value = null
  } catch (error) {
    console.error('Failed to confirm job:', error)
  }
}

async function skipJob() {
  if (!selectedJob.value) return

  try {
    // TODO: Call PATCH /api/review/[id] with status='skipped'
    pendingJobs.value = pendingJobs.value.filter(j => j.id !== selectedJob.value!.id)
    selectedJob.value = null
  } catch (error) {
    console.error('Failed to skip job:', error)
  }
}

onMounted(async () => {
  // TODO: Fetch pending review jobs from /api/review
})
</script>
