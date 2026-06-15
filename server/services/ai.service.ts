import OpenAI from 'openai'
import prisma from '~/server/utils/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Service for AI-powered enrichment (salary parsing, company summaries)
 */
export class AIService {
  /**
   * Parse salary from job description
   */
  static async parseSalary(description: string): Promise<{ min: number | null; max: number | null; currency: string | null }> {
    try {
      const message = await openai.messages.create({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Extract the salary or salary range from the following job description. Return only a JSON object: { "min": number | null, "max": number | null, "currency": string | null }. If salary is not explicitly mentioned, return { "min": null, "max": null, "currency": null }. Do not infer, estimate, or guess. Only extract if explicitly stated.\n\nJob description:\n${description}`
          }
        ]
      })

      const content = message.content[0]
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text)
        } catch {
          return { min: null, max: null, currency: null }
        }
      }

      return { min: null, max: null, currency: null }
    } catch (error) {
      console.error('Error parsing salary:', error)
      return { min: null, max: null, currency: null }
    }
  }

  /**
   * Generate company summary with Tavily search
   */
  static async getCompanySummary(companyName: string): Promise<string> {
    try {
      // Check cache first
      const cached = await prisma.companyCache.findUnique({
        where: { name: companyName }
      })

      if (cached && cached.cachedAt) {
        const daysSinceCached = Math.floor(
          (Date.now() - cached.cachedAt.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceCached < 30 && cached.summary) {
          return cached.summary
        }
      }

      // TODO: Call Tavily API to search for company info
      const tavilyResults = [] // await searchTavily(`${companyName} company overview`)

      // Call GPT-4o mini with search results
      const message = await openai.messages.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `In 2-3 sentences, summarize what this company does, where they are based, and what industry they operate in. Be factual and concise.\n\nCompany: ${companyName}\n\nSearch results:\n${JSON.stringify(tavilyResults)}`
          }
        ]
      })

      const content = message.content[0]
      const summary = content.type === 'text' ? content.text : ''

      // Cache summary
      if (cached) {
        await prisma.companyCache.update({
          where: { id: cached.id },
          data: { summary, cachedAt: new Date() }
        })
      } else {
        await prisma.companyCache.create({
          data: {
            name: companyName,
            summary,
            cachedAt: new Date()
          }
        })
      }

      return summary
    } catch (error) {
      console.error('Error generating company summary:', error)
      return 'Unable to fetch company information'
    }
  }
}

export function createAIService() {
  return AIService
}
