# Eazy — Improvement Backlog

Tracked areas for improvement from the code review. **Not yet executed** —
this is the queue, ordered roughly by priority. Check items off as they ship.

## P0 — Risk & blockers

- [ ] **LinkedIn account / ToS risk (product).** Automating Easy Apply can get
      accounts restricted. Current defenses: 3–8s random delay + 30/day cap.
      Add: human-like variable pacing (time-of-day aware), warm-up ramping
      (don't hit 30 on day one), randomized scroll/mouse behavior, and an
      explicit user warning. No code fully removes this risk.
- [ ] **Resume not attached (functional blocker).** Many Easy Apply forms
      require a resume; the worker never uploads one. Build `/api/profile/resume`
      → Supabase bucket, then download `resume_url` and `setInputFiles()` in the
      fill step. Without this, real applies fail at submit.

## P1 — Reliability & architecture

- [ ] **Worker is fire-and-forget in a server route.** On serverless it's reaped
      after the response. Run the loop on a persistent host (VPS/Railway/Render/Fly).
- [ ] **In-memory state is process-local.** `runningWorkers` and the LinkedIn
      session store break across instances / restarts and can leak Steel
      sessions (browser-hour cost). Persist run state + handshake in the DB.
- [ ] **No crash recovery.** If the process dies mid-run, partial state is lost
      and the Steel session leaks. Add a heartbeat + cleanup.

## P1 — Security

- [ ] **No CSRF protection.** Cookie-authed state-changing routes (e.g.
      `/api/automation/start`) are CSRF-able. Add CSRF tokens or strict origin
      checks; confirm session cookie `SameSite`.
- [ ] **No rate limiting on `/api/auth/login`** (brute force). Add per-IP limits.
- [ ] **`zod` is a dependency but unused.** Validate all request bodies with zod
      schemas instead of ad-hoc checks.

## P2 — Cost & efficiency (AI/LinkedIn calls)

- [ ] **Company research runs before the skip decision.** `getCompanySummary`
      (Tavily + LLM) fires for every job, even ones we immediately skip. Move it
      into the apply/review path only.
- [ ] **Skipped jobs aren't recorded as "seen".** They get re-opened and
      re-evaluated every run (repeated cost + LinkedIn activity). Dedupe skips
      via `decision_log` by `linkedinJobId` (or a seen-set).
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
