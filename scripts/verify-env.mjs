#!/usr/bin/env node
/**
 * Verify every external credential in .env actually connects.
 * Run on a machine with normal network access:  npm run verify:env
 *
 * Checks: Neon Postgres (DATABASE_URL), Sumopod AI (AI_*), Tavily, Supabase
 * Storage. Steel is checked for presence only (a live check would burn a
 * browser-session minute).
 */
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

// --- load .env (no deps) ---
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
const E = process.env
const results = []
const rec = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name.padEnd(20)} ${detail}`)
}

// --- 1. Postgres: SSLRequest preflight (proves host reachable + speaks Postgres/SSL) ---
async function checkDb() {
  if (!E.DATABASE_URL) return rec('Database', false, 'DATABASE_URL empty')
  let u
  try {
    u = new URL(E.DATABASE_URL)
  } catch {
    return rec('Database', false, 'DATABASE_URL is not a valid URL')
  }
  const host = u.hostname
  const port = Number(u.port || 5432)
  await new Promise((resolve) => {
    const sock = net.connect({ host, port })
    let settled = false
    const done = (ok, detail) => {
      if (settled) return
      settled = true
      rec('Database', ok, `${host}:${port} — ${detail}`)
      sock.destroy()
      resolve()
    }
    sock.setTimeout(10000)
    sock.on('connect', () => {
      // Postgres SSLRequest: int32 len=8, int32 code=80877103
      sock.write(Buffer.from([0, 0, 0, 8, 0x04, 0xd2, 0x16, 0x2f]))
    })
    sock.on('data', (b) => {
      const c = String.fromCharCode(b[0])
      if (c === 'S') done(true, 'reachable, SSL supported (run `npx prisma migrate dev` to finish)')
      else if (c === 'N') done(true, 'reachable, but SSL not offered — add ?sslmode=require')
      else done(false, `unexpected reply '${c}'`)
    })
    sock.on('timeout', () => done(false, 'timeout — host blocked or wrong port'))
    sock.on('error', (e) => done(false, `${e.code} — host unreachable / DNS`))
  })
}

// --- 2. Sumopod AI: a real chat completion ---
async function checkAI() {
  if (!E.AI_API_KEY) return rec('Sumopod AI', false, 'AI_API_KEY empty')
  const base = (E.AI_BASE_URL || 'https://ai.sumopod.com/v1').replace(/\/$/, '')
  const model = E.AI_MODEL || 'gpt-5.4-mini'
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${E.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply: OK' }], max_tokens: 5 })
    })
    const t = await r.text()
    if (!r.ok) return rec('Sumopod AI', false, `HTTP ${r.status}: ${t.slice(0, 120)}`)
    const out = JSON.parse(t).choices?.[0]?.message?.content?.trim()
    rec('Sumopod AI', !!out, `model ${model} replied: ${JSON.stringify(out)}`)
  } catch (e) {
    rec('Sumopod AI', false, e.message)
  }
}

// --- 3. Tavily search ---
async function checkTavily() {
  if (!E.TAVILY_API_KEY) return rec('Tavily', false, 'TAVILY_API_KEY empty (optional)')
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: E.TAVILY_API_KEY, query: 'test', max_results: 1 })
    })
    rec('Tavily', r.ok, r.ok ? 'search OK' : `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`)
  } catch (e) {
    rec('Tavily', false, e.message)
  }
}

// --- 4. Supabase Storage (service key) ---
async function checkSupabase() {
  if (!E.SUPABASE_URL || !E.SUPABASE_SERVICE_KEY) return rec('Supabase', false, 'SUPABASE_URL / SERVICE_KEY empty')
  try {
    const r = await fetch(`${E.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/bucket`, {
      headers: { apikey: E.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_KEY}` }
    })
    if (r.ok) {
      const buckets = JSON.parse(await r.text())
      rec('Supabase', true, `storage OK — ${buckets.length} bucket(s)`)
    } else {
      rec('Supabase', false, `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`)
    }
  } catch (e) {
    rec('Supabase', false, e.message)
  }
}

// --- 5. Steel: presence only ---
function checkSteel() {
  rec('Steel', !!E.STEEL_API_KEY, E.STEEL_API_KEY ? 'key present (live check skipped)' : 'STEEL_API_KEY empty — LinkedIn automation will not run')
}

console.log('Verifying Eazy environment...\n')
await checkDb()
await checkAI()
await checkTavily()
await checkSupabase()
checkSteel()

const required = results.filter((r) => ['Database', 'Sumopod AI', 'Supabase'].includes(r.name))
const ok = required.every((r) => r.ok)
console.log(`\n${ok ? '✅ Core services connect.' : '❌ Some core services failed — see above.'}`)
process.exit(ok ? 0 : 1)
