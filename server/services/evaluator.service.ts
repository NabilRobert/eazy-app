import prisma from '~/server/utils/prisma'
import { getAIClient, aiModel } from '~/server/utils/ai-client'
import type { JobDetail } from '~/server/services/linkedin.service'

/** Prompt/rubric version — bump when the evaluator logic changes (for eval gating). */
export const EVALUATOR_VERSION = 'evaluator@v1'

export type DecisionVerdict = 'apply' | 'review' | 'skip'

export interface CriterionResult {
  name: string
  verdict: 'pass' | 'partial' | 'fail'
  weight: number
  note: string
}

export interface EvaluationResult {
  decision: DecisionVerdict
  score: number // 0..1 fit
  criteria: CriterionResult[]
  rationale: string
  promptVersion: string
  model: string
}

/**
 * The "brain": judges how well a job fits the candidate and explains why.
 * Produces a structured, explainable decision and (optionally) persists it to
 * decision_log so the Thought Process page and the improvement loop can use it.
 */
export class EvaluatorService {
  /**
   * Evaluate a job against the candidate profile. `companyResearch` is an
   * optional summary/signal string from the researcher agent.
   */
  static async evaluateJob(
    profile: any,
    job: JobDetail,
    companyResearch = ''
  ): Promise<EvaluationResult> {
    const rubric = this.buildRubric(profile)

    try {
      const resp = await getAIClient().chat.completions.create({
        model: aiModel(),
        max_tokens: 700,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are Eazy\'s job-fit evaluator. Judge how well a job matches a candidate ' +
              'using ONLY the provided rubric and facts. Be honest and specific; do not invent ' +
              'requirements. Respond ONLY with the JSON schema requested.'
          },
          {
            role: 'user',
            content: this.buildPrompt(rubric, job, companyResearch)
          }
        ]
      })

      const raw = resp.choices[0]?.message?.content ?? '{}'
      return this.parseResult(raw)
    } catch (error: any) {
      console.error('[Evaluator] evaluateJob failed:', error?.message)
      // Fail safe: route to manual review rather than auto-applying blindly.
      return {
        decision: 'review',
        score: 0,
        criteria: [],
        rationale: `Evaluator error (${error?.message ?? 'unknown'}); routed to review.`,
        promptVersion: EVALUATOR_VERSION,
        model: aiModel()
      }
    }
  }

  /** Persist an evaluation to decision_log (self-contained job context). */
  static async persistDecision(
    userId: string,
    job: JobDetail,
    result: EvaluationResult,
    jobId: string | null = null
  ): Promise<void> {
    try {
      await prisma.decisionLog.create({
        data: {
          userId,
          jobId,
          linkedinJobId: job.linkedinJobId,
          jobTitle: job.title,
          company: job.company,
          jobUrl: job.jobUrl,
          agent: 'evaluator',
          decision: result.decision,
          score: result.score,
          criteria: result.criteria as any,
          rationale: result.rationale,
          promptVersion: result.promptVersion,
          model: result.model
        }
      })
    } catch (error: any) {
      console.error('[Evaluator] persistDecision failed:', error?.message)
    }
  }

  /** Build the weighted rubric from the candidate profile. */
  private static buildRubric(profile: any) {
    return {
      desiredPosition: profile.desiredPosition ?? '',
      yearsExperience: profile.yearsExperience ?? null,
      education: profile.education ?? '',
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      preferredLocation: profile.preferredLocation ?? '',
      employmentType: profile.employmentType ?? '',
      minSalary: profile.minSalary ?? null,
      strictExperience: !!profile.strictExperience,
      strictDegree: !!profile.strictDegree
    }
  }

  private static buildPrompt(rubric: any, job: JobDetail, companyResearch: string): string {
    return [
      'CANDIDATE RUBRIC (JSON):',
      JSON.stringify(rubric, null, 2),
      '',
      'JOB (JSON):',
      JSON.stringify(
        {
          title: job.title,
          company: job.company,
          location: job.location,
          employmentType: job.employmentType,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          description: (job.description || '').slice(0, 4000)
        },
        null,
        2
      ),
      '',
      `COMPANY RESEARCH: ${companyResearch || '(none)'}`,
      '',
      'Evaluate fit across these criteria: role/title match, seniority vs years of',
      'experience, required skills coverage, location/employment-type fit, salary vs',
      'minimum, and education (only if the candidate set strictDegree).',
      'Respect strictExperience/strictDegree: if true and the job clearly violates it,',
      'that criterion must FAIL. If false, treat gaps as PARTIAL, not disqualifying.',
      '',
      'Return ONLY this JSON:',
      '{',
      '  "decision": "apply" | "review" | "skip",',
      '  "score": number (0..1),',
      '  "criteria": [{ "name": string, "verdict": "pass"|"partial"|"fail", "weight": number (0..1), "note": string }],',
      '  "rationale": string (2-4 sentences explaining the decision)',
      '}',
      'Guidance: "apply" for a strong fit, "skip" for a clear mismatch, "review" when',
      'genuinely uncertain or a hard requirement conflicts.'
    ].join('\n')
  }

  /** Parse + sanitize the model JSON into a safe EvaluationResult. */
  private static parseResult(raw: string): EvaluationResult {
    const model = aiModel()
    try {
      const j = JSON.parse(raw)
      const decision: DecisionVerdict =
        j.decision === 'apply' || j.decision === 'skip' || j.decision === 'review' ? j.decision : 'review'
      const score = typeof j.score === 'number' ? Math.max(0, Math.min(1, j.score)) : 0
      const criteria: CriterionResult[] = Array.isArray(j.criteria)
        ? j.criteria.map((c: any) => ({
            name: String(c?.name ?? 'criterion'),
            verdict: c?.verdict === 'pass' || c?.verdict === 'fail' ? c.verdict : 'partial',
            weight: typeof c?.weight === 'number' ? Math.max(0, Math.min(1, c.weight)) : 0,
            note: String(c?.note ?? '')
          }))
        : []
      const rationale = String(j.rationale ?? '').trim()
      return { decision, score, criteria, rationale, promptVersion: EVALUATOR_VERSION, model }
    } catch {
      return {
        decision: 'review',
        score: 0,
        criteria: [],
        rationale: 'Could not parse evaluator output; routed to review.',
        promptVersion: EVALUATOR_VERSION,
        model
      }
    }
  }
}

export function createEvaluatorService() {
  return EvaluatorService
}
