/**
 * Debounced location search against /api/places (OpenStreetMap Nominatim).
 * Returns place description strings for an autocomplete dropdown.
 */
export function usePlaceSearch() {
  const suggestions = ref<string[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function search(q: string) {
    if (timer) clearTimeout(timer)
    if (!q || q.trim().length < 3) {
      suggestions.value = []
      return
    }
    timer = setTimeout(async () => {
      loading.value = true
      try {
        const res = await $fetch<{ success: boolean; data: string[] }>('/api/places', { params: { q } })
        suggestions.value = res.data || []
      } catch {
        suggestions.value = []
      } finally {
        loading.value = false
      }
    }, 350)
  }

  function clear() {
    suggestions.value = []
  }

  return { suggestions, loading, search, clear }
}
