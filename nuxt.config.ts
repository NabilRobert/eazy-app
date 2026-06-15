export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxtjs/tailwindcss'
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
    openai_api_key: process.env.OPENAI_API_KEY,
    tavily_api_key: process.env.TAVILY_API_KEY,
    supabase_url: process.env.SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_KEY,
    encrypt_secret: process.env.ENCRYPT_SECRET,
    nuxt_session_secret: process.env.NUXT_SESSION_SECRET,
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
