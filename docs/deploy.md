# Eazy — Deployment

## The key constraint

The automation **worker loop runs for minutes** per session (job-by-job). On a
serverless platform (e.g. Vercel) a function is reaped after it sends its HTTP
response, so the background loop would be killed mid-run. Therefore Eazy must
run on a **persistent Node host**, not serverless.

Good news: because browser automation runs on **Steel.dev** (remote Chromium)
and Playwright only connects over CDP, the host needs **no browser binary** —
any standard Node 20 host works, and the container stays small.

## Recommended: one persistent host

Deploy the whole Nuxt app (frontend + API + worker) to a long-lived host:
Railway, Render, Fly.io, or a small VPS. The worker rides along in-process and
the DB-backed run-state (`automationStatus` + heartbeat) keeps `/status` correct
across restarts.

Build & run:

```
npm install
npx prisma migrate deploy      # apply migrations in prod
npm run build
node .output/server/index.mjs  # Nuxt/Nitro production server
```

Set all `.env` vars in the host's environment (see `.env.example`).

### Example: Render (render.yaml)

```yaml
services:
  - type: web
    name: eazy
    env: node
    plan: starter
    buildCommand: npm install && npx prisma generate && npm run build
    startCommand: npx prisma migrate deploy && node .output/server/index.mjs
    healthCheckPath: /login
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: STEEL_API_KEY
        sync: false
      - key: AI_API_KEY
        sync: false
      - key: AI_BASE_URL
        value: https://ai.sumopod.com/v1
      - key: AI_MODEL
        value: gpt-5.4-mini
      - key: TAVILY_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: ENCRYPT_SECRET
        sync: false
      - key: NUXT_SESSION_SECRET
        sync: false
```

## If you must use serverless for the web tier

Split into two deploys: the Nuxt frontend/API on Vercel, and a **separate worker
service** on a persistent host that runs the loop. Both share the same Neon DB.
This also requires moving the LinkedIn auth handshake store (currently
process-local — it holds a live Playwright connection between the login and 2FA
requests) to a reconnect-via-CDP model so the verify step can run on any
instance. Until that's done, keep the web tier and worker on the same process.

## Scaling notes

- The in-memory rate limiter and the LinkedIn handshake store are process-local.
  For multiple instances, back the rate limiter with Redis and implement the
  CDP-reconnect handshake.
- One worker per user at a time is enforced via the DB heartbeat.
