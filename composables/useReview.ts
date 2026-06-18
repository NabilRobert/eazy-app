import type { ReviewItem } from '~/types/review'

/**
 * Review-queue logic: load pending items, select one, confirm/skip. Owns its
 * own mount fetch so the page is presentational.
 */
export function useReview() {
  const pendingJobs = ref<ReviewItem[]>([])
  const selectedJob = ref<ReviewItem | null>(null)

  function selectJob(job: ReviewItem) {
    selectedJob.value = job
  }

  async function resolve(action: 'confirm' | 'skip') {
    if (!selectedJob.value) return
    const id = selectedJob.value.id
    try {
      await $fetch(`/api/review/${id}`, { method: 'PATCH', body: { action } })
      pendingJobs.value = pendingJobs.value.filter((j) => j.id !== id)
      selectedJob.value = pendingJobs.value[0] || null
    } catch (error) {
      console.error(`Failed to ${action} job:`, error)
    }
  }

  const confirmJob = () => resolve('confirm')
  const skipJob = () => resolve('skip')

  async function fetchReview() {
    try {
      const res = await $fetch<{ success: boolean; data: ReviewItem[] }>('/api/review')
      pendingJobs.value = res.data || []
      selectedJob.value = pendingJobs.value[0] || null
    } catch (error) {
      console.error('Failed to fetch review queue:', error)
    }
  }

  onMounted(fetchReview)

  return { pendingJobs, selectedJob, selectJob, confirmJob, skipJob }
}
