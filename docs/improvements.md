# Eazy — Improvement Backlog

Tracked areas for improvement from the code review. **Not yet executed** —
this is the queue, ordered roughly by priority. Check items off as they ship.

## P0 — Risk & blockers

- [ ] **LinkedIn account / ToS risk (product).** Automating Easy Apply can get
      accounts restricted. Current defenses: 3–8s random delay + 30/day cap.
      Add: human-like variable pacing (time-of-day aware), warm-up ramping
      (don't hit 30 on day one), randomized scroll/mouse behavior, and an
      explicit user warning. No code fully removes this risk.
- [x] **Resume attached.** `/api/profile/resume` → auto-created Supabase
      `resumes` bucket; worker downloads it per run and `setInputFiles()` on the
      apply path; settings UI upload field. (commit ffb7571)

## P1 — Reliability & architecture

- [ ] **Worker is fire-and-forget in a server route.** On serverless it's reaped
      after the response. Run the loop on a persistent host (VPS/Railway/Render/Fly).
- [x] **Worker run-state moved to DB.** `runningWorkers` map replaced by
      `candidate_profile.automationStatus` + `automationHeartbeat`; `/status`
      derives running from a fresh (<30s) heartbeat, so it's correct across
      restarts/instances and a crashed worker reads as not-running. (commit
      d19fb3c) — NOTE: the LinkedIn auth handshake store is still process-local
      (holds a live Playwright connection between two requests); reconnect-via-
      CDP is the eventual fix.

## P1 — Security

- [x] **CSRF protection added.** `server/middleware/security.ts` rejects
      mutating requests whose Origin host != request host. (commit 1a870ad)
- [x] **Auth rate limiting added.** `server/utils/rate-limit.ts`; login 10/min,
      register 5/min per IP. (commit 1a870ad) — in-memory; Redis for multi-instance.
- [x] **zod validation wired in.** `validateBody()` + shared schemas validate
      every body route (auth, linkedin-auth/verify, jobs/review PATCH, ai,
      profile PUT); profile PUT strips unknown keys. (commit 8bdafcf)

## P2 — Cost & efficiency (AI/LinkedIn calls)

- [x] **Company research no longer runs before the decision.** Evaluator
      decides from the posting alone; company summary only for applied jobs
      (enrich). (commit debbcf1)
- [x] **Skipped jobs deduped.** `alreadyProcessed()` skips jobs with a prior
      'skip' in `decision_log`, so they aren't re-opened/re-evaluated. (commit
      debbcf1)
- [ ] **Modal opened before the skip decision.** Scrape job detail without
      opening Easy Apply, evaluate, then open the modal only when the verdict is
      apply (cheaper + less bot-detectable).

## P2 — Correctness & edge cases

- [ ] **Timezone:** quota resets on server local time, not the user's local
      midnight (plan requires user-local). Store/compute per user timezone.
- [ ] **Reserved-slot quota nuance unimplemented.** The "10 confirmed slots that
      expand when none are pending" logic isn't wired — worker only checks
      `total >= 30`.
- [ ] **Review "confirm" doesn't re-apply.** It records intent + reserves a slot
      but never actually applies. Extract a single-job apply from the worker.
- [ ] Custom/relocation screening answers aren't captured at confirm time (V2).

## P3 — Type safety & testing

- [ ] **`typeCheck: false`** in nuxt.config and **~33 `: any`** in the server
      (e.g. `profile: any`, `job: any` in the evaluator). Use Prisma-generated
      types; enable `vue-tsc`/typeCheck in CI.
- [ ] **No committed automated tests / no CI.** Add unit tests for the pure
      logic (screening, password, salary parse, quota math) and a CI workflow
      (typecheck + tests + build).

## P3 — UX polish

- [ ] Fetch errors are swallowed to `console.error` with no user-facing state.
- [ ] LinkedIn modal lacks focus trap / Escape handling.
- [ ] Dashboard "running" status is process-local — can be wrong after reload.
- [ ] Jobs/decisions lists aren't paginated (fixed `take` limits).

## Suggested first sweep

resume attachment (P0) → CSRF + rate limiting (P1 security) → persist
worker/run state off memory (P1) → move company research out of skip path +
record skips (P2). Type-safety/tests can follow.
