# Eazy — AI Brain & Self-Improvement (V2 plan)

Supplements the V1 plan (PLAN.md.docx). Adds an explainable, self-improving
decision layer on top of the automation worker.

## 1. Goal

Move from regex/hard-filter decisions to **judged** decisions that (a) record
*why* every choice was made and (b) get better over time from the data Eazy
gathers. The model itself (gpt-5.4-mini via Sumopod) is fixed — improvement
happens in the rubric, prompt, context, and a per-agent policy distilled from
history. It's a data flywheel, not weight training.

## 2. Agents (built as structured steps, one task each)

| Agent | Job | Output |
|-------|-----|--------|
| Evaluator (the brain) | Score a job against the candidate rubric | `{ decision: apply\|review\|skip, score 0-1, criteria[], rationale }` |
| Researcher | Turn company research into structured signals | `{ industry, size, location, stability, redFlags[] }` |
| Searcher | Choose queries/filters; refine from what worked | search policy + chosen query |

Each is a focused prompt + JSON schema behind a typed interface, NOT a separate
runtime. Any one can later become a more autonomous agent without touching the
others (local call today → HTTP call to a worker/VPS tomorrow is a one-line swap).

## 3. Deployment decision

The brain is **in-backend** (`server/services/*`), same process as the worker —
it's just Sumopod API calls, nothing to host separately. The thing that needs a
**persistent host** (small VPS / Railway / Render / Fly) is the worker loop,
which runs for minutes per session and would be reaped on Vercel serverless. No
separate VPS for the AI itself until we self-host a model or need independent
worker scaling.

## 4. Explainability — the decision log (build first)

Every decision is persisted to `decision_log`, self-contained so it renders even
when no job row exists (e.g. a skip):

- inline job context: linkedinJobId, title, company, url
- `agent`, `decision`, `score`
- `criteria`: JSON array `[{ name, verdict: pass|partial|fail, weight, note }]`
- `rationale`: plain-English explanation
- `promptVersion`, `model`, `createdAt`

This single table powers the Thought Process page AND the improvement loop.

## 5. Thought Process page (`/decisions`)

Lists every decision (apply / review / skip) with a fit score, a colour-coded
per-criterion breakdown, and the natural-language rationale — i.e. *why this job
fit (or didn't)* and *how the brain got there*. Filter by decision/score; open a
row to see the full reasoning + the job context the brain saw.

## 6. Self-improvement loop

Two layers, both reading the brain's own accumulated data:

1. **Memory at decision time.** Before a run, an agent loads a distilled summary
   of its history (queries → fit scores → applied → outcome) and biases its next
   choices toward what worked.
2. **Scheduled reflection.** A scheduled task periodically reads the whole
   `decision_log` + job outcomes and rewrites a **versioned policy**
   (`agent_policy` table) per agent. Next runs load the new policy as context.

Ground truth = job status (applied → interview → offer → rejected), which Eazy
already tracks. Early on, lean on the immediate evaluator fit score; as real
outcomes accumulate (weeks), weight those more.

### Guardrails (so it can't self-degrade)
- **Eval set:** a fixed set of labelled past decisions. A new policy/prompt
  version must score *better* on it before promotion; auto-rollback if worse.
- **Cold start:** little data → lean on the base prompt; improves as history grows.
- **Min-evidence threshold:** don't change behaviour off 1–2 data points.
- **Versioning:** every decision records its `promptVersion`/policy version so
  versions are comparable on the eval set and on real outcomes.

## 7. Build order (dependency-ordered)

1. `decision_log` model (foundation).
2. Shared AI client util + `evaluator.service.ts` (writes decisions).
3. Worker calls evaluator to gate apply/review/skip + persist decision.
4. `/api/decisions` + Thought Process page (`/decisions`).
5. Structured researcher signals feeding the evaluator.
6. `agent_policy` table + memory-at-decision-time.
7. Scheduled reflection job + eval harness/gate.
8. (Optional, later) searcher agent; LLM-as-judge auto-grading; fine-tuning if
   ever warranted.

Steps 1–4 deliver the visible "show me the thinking" feature; 5–7 deliver the
self-improvement; 8 is future.
