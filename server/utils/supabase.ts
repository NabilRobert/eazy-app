import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Lazily build a service-role Supabase client (server-only, bypasses RLS). */
let _client: SupabaseClient | null = null
function getSupabase(): SupabaseClient {
  if (_client) return _client
  const cfg = useRuntimeConfig()
  if (!cfg.supabase_url || !cfg.supabase_service_key) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)')
  }
  _client = createClient(cfg.supabase_url, cfg.supabase_service_key, { auth: { persistSession: false } })
  return _client
}

export const RESUME_BUCKET = 'resumes'

/** Create the private resumes bucket if it doesn't exist yet. */
async function ensureResumeBucket(): Promise<void> {
  const sb = getSupabase()
  const { data } = await sb.storage.getBucket(RESUME_BUCKET)
  if (!data) {
    await sb.storage.createBucket(RESUME_BUCKET, { public: false })
  }
}

/** Upload (overwrite) a user's resume PDF; returns the storage path. */
export async function uploadResume(userId: string, bytes: Buffer): Promise<string> {
  await ensureResumeBucket()
  const path = `${userId}/resume.pdf`
  const { error } = await getSupabase()
    .storage.from(RESUME_BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return path
}

/** Download a resume by storage path into a Buffer (for Playwright upload). */
export async function downloadResume(path: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(RESUME_BUCKET).download(path)
  if (error || !data) throw error || new Error('Resume not found')
  return Buffer.from(await data.arrayBuffer())
}
