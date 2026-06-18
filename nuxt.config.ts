export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/tailwindcss',
    'nuxt-auth-utils'
  ],
  ssr: true,
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/sitemap.xml']
    }
  },
  runtimeConfig: {
    // Private keys (server-only)
    database_url: process.env.DATABASE_URL,
    steel_api_key: process.env.STEEL_API_KEY,
    // AI provider (Sumopod / any OpenAI-compatible endpoint)
    ai_api_key: process.env.AI_API_KEY,
    ai_base_url: process.env.AI_BASE_URL || 'https://ai.sumopod.com/v1',
    ai_model: process.env.AI_MODEL || 'gpt-5.4-mini',
    tavily_api_key: process.env.TAVILY_API_KEY,
    supabase_url: process.env.SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_KEY,
    encrypt_secret: process.env.ENCRYPT_SECRET,
    nuxt_session_secret: process.env.NUXT_SESSION_SECRET,
    // nuxt-auth-utils reads the sealed-session password from here
    session: {
      password: process.env.NUXT_SESSION_SECRET || ''
    },
    // Public keys (client-visible)
    public: {
      supabase_url: process.env.SUPABASE_URL,
      supabase_anon_key: process.env.SUPABASE_ANON_KEY
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  app: {
    head: {
      title: 'Eazy - Automated LinkedIn Job Applications',
      meta: [
        { name: 'description', content: 'Automate your LinkedIn Easy Apply job applications' }
      ]
    }
  }
})
