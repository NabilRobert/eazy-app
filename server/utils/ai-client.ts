import OpenAI from 'openai'

/**
 * Single source of truth for the AI provider. Points the OpenAI SDK at any
 * OpenAI-compatible endpoint (default: Sumopod, https://ai.sumopod.com/v1),
 * driven entirely by runtime config / env.
 */
let _client: OpenAI | null = null

export function getAIClient(): OpenAI {
  if (_client) return _client
  const config = useRuntimeConfig()
  const apiKey = config.ai_api_key
  if (!apiKey) throw new Error('AI_API_KEY is not configured')
  _client = new OpenAI({ apiKey, baseURL: config.ai_base_url })
  return _client
}

/** Configured model id (default gpt-5.4-mini). */
export function aiModel(): string {
  return useRuntimeConfig().ai_model || 'gpt-5.4-mini'
}
