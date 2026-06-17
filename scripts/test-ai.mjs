#!/usr/bin/env node
/**
 * Smoke-test the configured AI provider (Sumopod / any OpenAI-compatible
 * endpoint) using the same call shape as server/services/ai.service.ts.
 *
 * Usage:  node scripts/test-ai.mjs
 * Reads AI_API_KEY / AI_BASE_URL / AI_MODEL from .env.
 */
import fs from 'node:fs'
import path from 'node:path'

// --- minimal .env loader (no deps) ---
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const apiKey = process.env.AI_API_KEY
const baseURL = (process.env.AI_BASE_URL || 'https://ai.sumopod.com/v1').replace(/\/$/, '')
const model = process.env.AI_MODEL || 'gpt-5.4-mini'

if (!apiKey) {
  console.error('❌ AI_API_KEY is empty in .env — paste your Sumopod key and re-run.')
  process.exit(1)
}

console.log(`→ endpoint : ${baseURL}/chat/completions`)
console.log(`→ model    : ${model}`)
console.log(`→ key      : set (${apiKey.length} chars)\n`)

async function chat(messages, extra = {}) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 100, temperature: 0, ...extra })
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

let failed = false

// Test 1: basic round-trip
try {
  const r = await chat([{ role: 'user', content: 'Reply with exactly: PONG' }])
  const out = r.choices?.[0]?.message?.content?.trim()
  console.log(`Test 1 (basic completion): ${out ? 'PASS' : 'FAIL'} — model said: ${JSON.stringify(out)}`)
  if (!out) failed = true
} catch (e) {
  failed = true
  console.log(`Test 1 (basic completion): FAIL — ${e.message}`)
}

// Test 2: JSON salary parse (the exact AIService.parseSalary shape)
try {
  const desc = 'Senior Frontend Engineer. Compensation: $120,000 - $150,000 per year. Remote.'
  const r = await chat(
    [
      {
        role: 'user',
        content:
          'Extract the salary range. Return only JSON: ' +
          '{ "min": number|null, "max": number|null, "currency": string|null }. ' +
          'If not stated, all null. Do not guess.\n\n' + desc
      }
    ],
    { response_format: { type: 'json_object' } }
  )
  const parsed = JSON.parse(r.choices?.[0]?.message?.content ?? '{}')
  const ok = parsed.min === 120000 && parsed.max === 150000
  console.log(`Test 2 (JSON salary parse): ${ok ? 'PASS' : 'CHECK'} — parsed: ${JSON.stringify(parsed)}`)
  if (parsed.min == null && parsed.max == null) failed = true
} catch (e) {
  failed = true
  console.log(`Test 2 (JSON salary parse): FAIL — ${e.message}`)
}

console.log(failed ? '\n❌ AI endpoint test failed.' : '\n✅ AI endpoint works.')
process.exit(failed ? 1 : 0)
