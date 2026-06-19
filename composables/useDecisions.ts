import type { Criterion, Decision } from '~/types/decision'

/**
 * Thought Process logic: load the brain's decisions, filter by verdict, and the
 * presentation helpers the template binds to. Page stays declarative.
 */
export function useDecisions() {
  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Applied', value: 'apply' },
    { label: 'Review', value: 'review' },
    { label: 'Skipped', value: 'skip' }
  ]

  const PAGE = 50
  const decisions = ref<Decision[]>([])
  const selected = ref<Decision | null>(null)
  const activeFilter = ref('all')
  const loading = ref(true)
  const loadingMore = ref(false)
  const hasMore = ref(false)
  const loadError = ref('')

  function buildUrl(offset: number) {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
    if (activeFilter.value !== 'all') params.set('decision', activeFilter.value)
    return `/api/decisions?${params.toString()}`
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const res = await $fetch<{ success: boolean; data: Decision[] }>(buildUrl(0))
      decisions.value = res.data || []
      hasMore.value = decisions.value.length === PAGE
      selected.value = decisions.value[0] || null
    } catch (e) {
      console.error('Failed to load decisions:', e)
      decisions.value = []
      loadError.value = 'Could not load decisions. Refresh to try again.'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    try {
      const res = await $fetch<{ success: boolean; data: Decision[] }>(buildUrl(decisions.value.length))
      const batch = res.data || []
      decisions.value = [...decisions.value, ...batch]
      hasMore.value = batch.length === PAGE
    } catch (e) {
      console.error('Failed to load more decisions:', e)
    } finally {
      loadingMore.value = false
    }
  }

  function setFilter(v: string) {
    activeFilter.value = v
    load()
  }

  function criteriaOf(d: Decision): Criterion[] {
    const c = d.criteria
    if (Array.isArray(c)) return c as Criterion[]
    try {
      return typeof c === 'string' ? (JSON.parse(c) as Criterion[]) : []
    } catch {
      return []
    }
  }

  const scorePct = (score: number | null) => `${Math.round((score || 0) * 100)}%`
  const borderClass = (d: string) =>
    d === 'apply' ? 'border-green-500' : d === 'review' ? 'border-yellow-400' : 'border-gray-300'
  const badgeClass = (d: string) =>
    d === 'apply' ? 'bg-green-100 text-green-800' : d === 'review' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
  const verdictClass = (v: string) =>
    v === 'pass' ? 'bg-green-100 text-green-800' : v === 'fail' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString()
    } catch {
      return d
    }
  }

  onMounted(load)

  return {
    filters,
    decisions,
    selected,
    activeFilter,
    loading,
    loadingMore,
    hasMore,
    loadError,
    setFilter,
    loadMore,
    criteriaOf,
    scorePct,
    borderClass,
    badgeClass,
    verdictClass,
    formatDate
  }
}
