import axios from 'axios'
import { requireAuth } from '~/server/utils/auth'

/**
 * GET /api/places?q=...
 * Location autocomplete via OpenStreetMap Nominatim (free, no key). Returns a
 * short list of place description strings. Proxied server-side so we can set
 * the required User-Agent and keep usage within Nominatim's policy.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const q = String(getQuery(event).q || '').trim()
  if (q.length < 3) return { success: true, data: [] }

  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', addressdetails: 0, limit: 6, dedupe: 1 },
      headers: { 'User-Agent': 'Eazy-JobBot/1.0 (location autocomplete for job search)' },
      timeout: 8000
    })
    const results: any[] = Array.isArray(res.data) ? res.data : []
    const seen = new Set<string>()
    const data = results
      .map((r) => String(r.display_name || '').trim())
      .filter((d) => d && !seen.has(d) && (seen.add(d), true))
    return { success: true, data }
  } catch (err: any) {
    console.error('[places] lookup failed:', err?.message)
    return { success: true, data: [] }
  }
})
