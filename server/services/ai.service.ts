import OpenAI from 'openai'
import axios from 'axios'
import prisma from '~/server/utils/prisma'

const CACHE_DAYS = 30

/**
 * Lazily build the AI client from runtime config (env-driven). Points at any
 * OpenAI-compatible endpoint — defaults to Sumopod (https://ai.sumopod.com/v1).
 */
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (_openai) return _openai
  const config = useRuntimeConfig()
  const apiKey = config.ai_api_key
  if (!apiKey) throw new Error('AI_API_KEY is not configured')
  _openai = new OpenAI({ apiKey, baseURL: config.ai_base_url })
  return _openai
}

/** Configured model id (default gpt-5.4-mini). */
function aiModel(): string {
  return useRuntimeConfig().ai_model || 'gpt-5.4-mini'
}

/**
 * Service for AI-powered enrichment (salary parsing, company summaries).
 * All model calls use OpenAI gpt-4o-mini; company research uses Tavily.
 */
export class AIService {
  /**
   * Extract a salary range from a job description. Strictly returns nulls when
   * salary is not explicitly stated (no inference).
   */
  static async parseSalary(
    description: string
  ): Promise<{ min: number | null; max: number | null; currency: string | null }> {
    const empty = { min: null, max: null, currency: null }
    if (!description?.trim()) return empty

    try {
      const resp = await getOpenAI().chat.completions.create({
        model: aiModel(),
        max_tokens: 100,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content:
              'Extract the salary or salary range from the following job description. ' +
              'Return only a JSON object: { "min": number | null, "max": number | null, "currency": string | null }. ' +
              'If salary is not explicitly mentioned, return { "min": null, "max": null, "currency": null }. ' +
              'Do not infer, estimate, or guess. Only extract if explicitly stated.\n\n' +
              `Job description:\n${description}`
          }
        ]
      })

      const content = resp.choices[0]?.message?.content ?? ''
      try {
        const parsed = JSON.parse(content)
        return {
          min: typeof parsed.min === 'number' ? parsed.min : null,
          max: typeof parsed.max === 'number' ? parsed.max : null,
          currency: typeof parsed.currency === 'string' ? parsed.currency : null
        }
      } catch {
        return empty
      }
    } catch (error: any) {
      console.error('[AI] parseSalary failed:', error?.message)
      return empty
    }
  }

  /**
   * Return a cached or freshly generated 2-3 sentence company summary.
   * Cached summaries are shared across users and refreshed after 30 days.
   */
  static async getCompanySummary(companyName: string): Promise<string> {
    if (!companyName?.trim()) return ''

    try {
      const cached = await prisma.companyCache.findUnique({ where: { name: companyName } })
      if (cached?.summary && cached.cachedAt) {
        const ageDays = Math.floor((Date.now() - cached.cachedAt.getTime()) / 86_400_000)
        if (ageDays < CACHE_DAYS) return cached.summary
      }

      const research = await this.searchTavily(`${companyName} company overview`)

      const resp = await getOpenAI().chat.completions.create({
        model: aiModel(),
        max_tokens: 200,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content:
              'In 2-3 sentences, summarize what this company does, where they are based, and what ' +
              'industry they operate in. Be factual and concise.\n\n' +
              `Company: ${companyName}\n\nSearch results:\n${research.join('\n\n') || '(none)'}`
          }
        ]
      })

      const summary = resp.choices[0]?.message?.content?.trim() ?? ''
      if (!summary) return cached?.summary ?? ''

      if (cached) {
        await prisma.companyCache.update({
          where: { id: cached.id },
          data: { summary, cachedAt: new Date() }
        })
      } else {
        await prisma.companyCache.create({ data: { name: companyName, summary, cachedAt: new Date() } })
      }

      return summary
    } catch (error: any) {
      console.error('[AI] getCompanySummary failed:', error?.message)
      return 'Unable to fetch company information'
    }
  }

  /** Query Tavily and return the top result snippets as context strings. */
  private static async searchTavily(query: string): Promise<string[]> {
    const apiKey = useRuntimeConfig().tavily_api_key
    if (!apiKey) return []

    try {
      const resp = await axios.post(
        'https://api.tavily.com/search',
        { api_key: apiKey, query, max_results: 3, search_depth: 'basic' },
        { headers: { 'Content-Type': 'application/json' } }
      )
      const results: any[] = resp.data?.results ?? []
      return results
        .slice(0, 3)
        .map((r) => `${r.title ?? ''}: ${r.content ?? ''}`.trim())
        .filter(Boolean)
    } catch (error: any) {
      console.error('[Tavily] search failed:', error?.message)
      return []
    }
  }
}

export function createAIService() {
  return AIService
}
