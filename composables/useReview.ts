import type { ReviewItem } from '~/types/review'

/**
 * Review-queue logic: load pending items, select one, capture answers to any
 * flagged questions, and confirm/skip. Confirm sends the answers; the next
 * automation run applies the job.
 */
export function useReview() {
  const pendingJobs = ref<ReviewItem[]>([])
  const selectedJob = ref<ReviewItem | null>(null)
  const answers = reactive<Record<string, string>>({})

  function selectJob(job: ReviewItem) {
    selectedJob.value = job
    // Reset the answer inputs for the newly-selected item's questions.
    for (const k of Object.keys(answers)) delete answers[k]
    for (const q of job.questions || []) answers[q] = ''
  }

  async function resolve(action: 'confirm' | 'skip') {
    if (!selectedJob.value) return
    const id = selectedJob.value.id
    const body = action === 'confirm' ? { action, answers: { ...answers } } : { action }
    try {
      await $fetch(`/api/review/${id}`, { method: 'PATCH', body })
      pendingJobs.value = pendingJobs.value.filter((j) => j.id !== id)
      const next = pendingJobs.value[0] || null
      if (next) selectJob(next)
      else selectedJob.value = null
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
      if (pendingJobs.value[0]) selectJob(pendingJobs.value[0])
      else selectedJob.value = null
    } catch (error) {
      console.error('Failed to fetch review queue:', error)
    }
  }

  onMounted(fetchReview)

  return { pendingJobs, selectedJob, answers, selectJob, confirmJob, skipJob }
}
