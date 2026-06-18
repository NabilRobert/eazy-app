import prisma from '~/server/utils/prisma'
import type { AutomationStatus } from '~/types/automation'
import { createLinkedinService, type JobDetail, type SearchedJob } from '~/server/services/linkedin.service'
import { decryptSessionCookie } from '~/server/utils/encrypt'
import { QuotaService } from '~/server/services/quota.service'
import { AIService } from '~/server/services/ai.service'
import { EvaluatorService } from '~/server/services/evaluator.service'

const DAILY_LIMIT = 30

/**
 * Process-local registry of running workers, so /status can report whether a
 * loop is active in this instance. (Single-server/dev correct; for multi
 * instance, derive running state from a DB heartbeat instead.)
 */
const runningWorkers = new Map<string, string>() // userId -> human status string

/**
 * Main worker loop for LinkedIn automation. Runs job-by-job until stop_flag is
 * set, the daily limit is hit, or the day rolls over.
 */
export class AutomationService {
  private userId: string
  private stopFlag = false

  constructor(userId: string) {
    this.userId = userId
  }

  /** Stop conditions checked before every job: explicit stop or quota hit. */
  async shouldStop(): Promise<boolean> {
    if (this.stopFlag) return true
    const quota = await QuotaService.getOrCreateQuota(this.userId)
    return quota.stopFlag || quota.totalApplied >= DAILY_LIMIT
  }

  /** Current run status + quota counts, for GET /api/automation/status. */
  async getStatus(): Promise<AutomationStatus> {
    try {
      const quota = await QuotaService.getOrCreateQuota(this.userId)
      const running = runningWorkers.has(this.userId) && !quota.stopFlag
      return {
        running,
        quota: {
          auto: quota.autoApplied,
          confirmed: quota.confirmedApplied,
          total: quota.totalApplied
        },
        status: running ? runningWorkers.get(this.userId) || 'running' : 'idle'
      }
    } catch {
      return {
        running: false,
        quota: { auto: 0, confirmed: 0, total: 0 },
        status: 'error',
        error: 'Failed to fetch status'
      }
    }
  }

  /**
   * Validate preconditions and run the worker loop to completion. The caller
   * (POST /api/automation/start) decides whether to await or fire-and-forget.
   */
  async start(): Promise<void> {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: this.userId } })
    if (!profile) throw new Error('Profile not found')
    if (profile.linkedinAuthStatus !== 'authenticated') {
      throw new Error('LinkedIn not authenticated. Please connect first.')
    }
    if (!profile.desiredPosition) {
      throw new Error('Set a desired position in Settings before starting.')
    }

    if (runningWorkers.has(this.userId)) {
      throw new Error('Automation is already running.')
    }

    this.stopFlag = false
    await QuotaService.setStopFlag(this.userId, false)

    // Mark running synchronously so a rapid second /start is rejected, then run
    // the loop in the background; the route returns and the client polls /status.
    runningWorkers.set(this.userId, 'starting')
    void this.run(profile).catch((e) => console.error('[Automation] background loop error:', e?.message))
  }

  /** Signal the running loop to stop before its next job. */
  async stop(): Promise<void> {
    this.stopFlag = true
    await QuotaService.setStopFlag(this.userId, true)
  }

  /**
   * The worker loop. Restores the LinkedIn session, searches with the user's
   * targeting filters, then for each job runs the pre-checks (stop / quota /
   * midnight / duplicate / salary / screening) before filling and submitting.
   */
  private async run(profile: any): Promise<void> {
    const config = useRuntimeConfig()
    const service = createLinkedinService(config.steel_api_key)
    runningWorkers.set(this.userId, 'starting')

    try {
      // Restore the encrypted LinkedIn session into a fresh Steel browser.
      const cookies = profile.sessionCookieEnc
        ? decryptSessionCookie(profile.sessionCookieEnc).cookies ?? []
        : []
      await service.createSession()
      await service.connectPlaywright()
      const valid = await service.loadSession(cookies)
      if (!valid) {
        await prisma.candidateProfile.update({
          where: { userId: this.userId },
          data: { linkedinAuthStatus: 'expired' }
        })
        runningWorkers.set(this.userId, 'expired')
        return
      }

      const answers = this.buildAnswers(profile)
      runningWorkers.set(this.userId, 'searching')
      const jobs = await service.searchJobs({
        keywords: profile.desiredPosition,
        location: profile.preferredLocation || undefined,
        employmentType: profile.employmentType || undefined,
        sort: profile.jobSort === 'relevant' ? 'relevant' : 'recent',
        limit: 50
      })

      runningWorkers.set(this.userId, 'applying')
      for (const job of jobs) {
        // 1-3. Stop flag / daily limit / midnight rollover.
        if (await this.shouldStop()) break
        if (await QuotaService.resetQuotaIfNeeded(this.userId)) break // new day -> stop, quota reset

        // 5. Duplicate detection.
        if (await this.isDuplicate(job.linkedinJobId)) continue

        // 4 + scrape. Open the job and read its detail.
        const { opened, detail } = await service.openEasyApply(job.jobUrl)
        if (!detail) continue

        // 6. Salary filter (only when a salary is disclosed).
        if (this.belowMinSalary(profile.minSalary, detail)) {
          await service.closeApplyModal()
          continue
        }

        if (!opened) continue // no Easy Apply (external apply) — skip silently

        const salarySource = detail.salaryMin != null || detail.salaryMax != null ? 'structured' : 'not_disclosed'

        // 7. THE BRAIN: evaluate fit. Decides apply / review / skip with a
        //    structured, explainable rationale (replaces the old regex filters).
        const research = await AIService.getCompanySummary(detail.company).catch(() => '')
        const evaluation = await EvaluatorService.evaluateJob(profile, detail, research)

        if (evaluation.decision === 'skip') {
          await EvaluatorService.persistDecision(this.userId, detail, evaluation, null)
          await service.closeApplyModal()
          continue
        }

        if (evaluation.decision === 'review') {
          const saved = await this.saveJob(detail, job, { needsReview: true, salarySource })
          await this.flagForReview(saved.id, ['low_fit'])
          await EvaluatorService.persistDecision(this.userId, detail, evaluation, saved.id)
          await service.closeApplyModal()
          continue
        }

        // decision === 'apply' — but screening questions still override to review.
        const reasons = await service.detectScreeningQuestions(answers)
        if (reasons.length) {
          const saved = await this.saveJob(detail, job, { needsReview: true, salarySource })
          await this.flagForReview(saved.id, reasons)
          await EvaluatorService.persistDecision(
            this.userId,
            detail,
            { ...evaluation, decision: 'review', rationale: `${evaluation.rationale} [Auto-apply held: ${reasons.join(', ')}]` },
            saved.id
          )
          await service.closeApplyModal()
          continue
        }

        // 12. Fill the multi-step form.
        const fill = await service.fillEasyApplyForm(answers)
        if (fill.status !== 'ready_to_submit') {
          // Unexpected required fields surfaced — treat as review, don't submit.
          const saved = await this.saveJob(detail, job, { needsReview: true, salarySource })
          await this.flagForReview(saved.id, ['custom_screening'])
          await EvaluatorService.persistDecision(
            this.userId,
            detail,
            { ...evaluation, decision: 'review', rationale: `${evaluation.rationale} [Form needs manual input]` },
            saved.id
          )
          await service.closeApplyModal()
          continue
        }

        // 13. Submit.
        const ok = await service.submitEasyApply()
        if (!ok) {
          await service.closeApplyModal()
          continue
        }

        // 14-15. Persist + count + log the (successful) apply decision.
        const saved = await this.saveJob(detail, job, { needsReview: false, salarySource })
        await EvaluatorService.persistDecision(this.userId, detail, evaluation, saved.id)
        await QuotaService.incrementAutoApplied(this.userId)

        // 16. AI enrichment, non-blocking.
        this.enrich(saved.id, detail).catch((e) => console.error('[enrich]', e?.message))

        // 18. Human-like delay before the next job.
        await service.randomDelay()
      }
    } catch (err: any) {
      console.error(`[Automation] worker loop failed: ${err.message}`)
      runningWorkers.set(this.userId, 'error')
    } finally {
      await service.closeSession().catch(() => {})
      runningWorkers.delete(this.userId)
    }
  }

  /** Build the label->value answer map from profile + prefilled answers. */
  private buildAnswers(profile: any): Record<string, string> {
    const answers: Record<string, string> = {}
    if (profile.fullName) answers['full name'] = profile.fullName
    if (profile.phone) answers['phone'] = profile.phone
    if (profile.location) answers['location'] = profile.location
    if (profile.linkedinEmail) answers['email'] = profile.linkedinEmail
    if (profile.yearsExperience != null) answers['years of experience'] = String(profile.yearsExperience)
    if (profile.education) answers['education'] = profile.education
    const prefilled = (profile.prefilledAnswers ?? {}) as Record<string, string>
    for (const [k, v] of Object.entries(prefilled)) if (v) answers[k] = v
    return answers
  }

  private async isDuplicate(linkedinJobId: string): Promise<boolean> {
    const existing = await prisma.job.findUnique({
      where: { userId_linkedinJobId: { userId: this.userId, linkedinJobId } }
    })
    return !!existing
  }

  /** True only when a salary is disclosed AND its max is below the user min. */
  private belowMinSalary(minSalary: number | null, detail: JobDetail): boolean {
    if (!minSalary) return false
    const disclosed = detail.salaryMax ?? detail.salaryMin
    return disclosed != null && disclosed < minSalary
  }

  /** Insert/refresh the job row (idempotent on userId+linkedinJobId). */
  private async saveJob(
    detail: JobDetail,
    listing: SearchedJob,
    opts: { needsReview: boolean; salarySource: string }
  ) {
    const data = {
      title: detail.title || listing.title,
      company: detail.company || listing.company,
      location: detail.location || listing.location,
      employmentType: detail.employmentType,
      postedDate: detail.postedDate,
      salaryMin: detail.salaryMin,
      salaryMax: detail.salaryMax,
      salarySource: opts.salarySource,
      description: detail.description,
      jobUrl: detail.jobUrl || listing.jobUrl,
      needsReview: opts.needsReview
    }
    return prisma.job.upsert({
      where: { userId_linkedinJobId: { userId: this.userId, linkedinJobId: listing.linkedinJobId } },
      create: { userId: this.userId, linkedinJobId: listing.linkedinJobId, ...data },
      update: data
    })
  }

  /** Add review-queue rows for each detected screening reason. */
  private async flagForReview(jobId: string, reasons: string[]) {
    const unique = [...new Set(reasons)]
    for (const reason of unique) {
      await prisma.reviewQueue.create({ data: { userId: this.userId, jobId, reason } })
    }
  }

  /**
   * Async enrichment: AI salary parse when no structured salary, plus a cached
   * company summary. Never blocks the worker loop.
   */
  private async enrich(jobId: string, detail: JobDetail): Promise<void> {
    if (detail.salaryMin == null && detail.salaryMax == null && detail.description) {
      const parsed = await AIService.parseSalary(detail.description)
      if (parsed.min != null || parsed.max != null) {
        await prisma.job.update({
          where: { id: jobId },
          data: { salaryMin: parsed.min, salaryMax: parsed.max, salarySource: 'ai_parsed' }
        })
      }
    }
    if (detail.company) {
      await AIService.getCompanySummary(detail.company)
      const cache = await prisma.companyCache.findUnique({ where: { name: detail.company } })
      if (cache) await prisma.job.update({ where: { id: jobId }, data: { companyId: cache.id } })
    }
  }
}

export function createAutomationService(userId: string) {
  return new AutomationService(userId)
}
