# Eazy — Improvement Backlog

Tracked areas for improvement from the code review. **Not yet executed** —
this is the queue, ordered roughly by priority. Check items off as they ship.

## P0 — Risk & blockers

- [x] **Account-safety pacing added** (risk reduced, not eliminated). Warm-up
      ramp (10 day 1 → +5/day → 30), variable delays with occasional long
      pauses, and a ToS warning banner on the dashboard. (commit 8632424)
- [x] **Resume attached.** `/api/profile/resume` → auto-created Supabase
      `resumes` bucket; worker downloads it per run and `setInputFiles()` on the
      apply path; settings UI upload field. (commit ffb7571)

## P1 — Reliability & architecture

- [x] **Persistent-host deployment documented.** `docs/deploy.md` — run the
      whole app (worker in-process) on Railway/Render/Fly/VPS; example render.yaml
      + the split-deploy caveat. (No browser binary needed — Steel is remote.)
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
- [x] **Evaluate before opening the modal.** `scrapeJobDetail()` +
      `openApplyModal()` split; worker evaluates first, opens the form only on
      'apply'. (commit f03a151)

## P2 — Correctness & edge cases

- [x] **Timezone-correct reset.** `QuotaService.localDay(tz)` resets at the
      user's local midnight; `candidate_profile.timezone`. (commit 6a73288)
- [x] **Reserved-slot quota implemented.** Auto-apply caps at 20 while confirmed
      items pend (10 reserved), expands to 30 otherwise. (commit 6a73288)
- [x] **Review "confirm" re-applies.** Confirm captures answers; the worker
      applies confirmed items next run using reserved slots. (commit 940853e)
- [x] **Screening answers captured at confirm time.** Review UI shows an answer
      box per flagged question; saved + applied next run. (commit 940853e)

## P3 — Type safety & testing

- [x] **Type-check tooling + CI.** `npm run typecheck` (nuxt typecheck/vue-tsc)
      and a CI workflow run it on every push. (commit d39b44c) Some `: any`
      remain (mostly `err: any` + worker `profile: any`); the typecheck run will
      guide further tightening.
- [x] **Tests + CI added.** vitest unit tests (screening + password, 9 green)
      and `.github/workflows/ci.yml` (install → generate → typecheck → test →
      build). (commit d39b44c)

## P3 — UX polish

- [x] Fetch-error banners on dashboard + decisions. (commit aad7874)
- [x] LinkedIn modal: Escape closes + autofocus. (commit aad7874)
- [x] Dashboard "running" status is now DB-backed (fixed by #3, commit d19fb3c).
- [x] Decisions list paginated ('Load more'). Jobs list keeps its 200 cap
      (live-polling model makes append-pagination awkward). (commit aad7874)

## Suggested first sweep

resume attachment (P0) → CSRF + rate limiting (P1 security) → persist
worker/run state off memory (P1) → move company research out of skip path +
record skips (P2). Type-safety/tests can follow.
