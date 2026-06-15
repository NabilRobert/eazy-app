# Eazy — Automated LinkedIn Easy Apply Bot

A Nuxt 3 full-stack application that automates LinkedIn Easy Apply job applications with a job tracking dashboard.

## Project Structure

```
eazy/
├── prisma/
│   ├── schema.prisma          # Database schema (Postgres)
│   └── migrations/            # Database migrations
│
├── server/
│   ├── api/                   # Nuxt server routes (API endpoints)
│   │   ├── auth/              # Authentication routes
│   │   ├── profile/           # Profile management
│   │   ├── jobs/              # Job catalogue
│   │   ├── automation/        # Start/Stop/Status
│   │   ├── review/            # Review queue
│   │   └── ai/                # AI enrichment
│   │
│   ├── services/              # Business logic
│   │   ├── automation.service.ts   # Main worker loop
│   │   ├── linkedin.service.ts     # Playwright + Steel.dev
│   │   ├── screening.service.ts    # Screening question detection
│   │   ├── ai.service.ts           # Salary + company summary
│   │   └── quota.service.ts        # Daily quota management
│   │
│   └── utils/                 # Utilities
│       ├── prisma.ts          # Prisma client singleton
│       ├── encrypt.ts         # AES-256 encryption
│       └── auth.ts            # Auth helpers
│
├── pages/                     # Vue pages
│   ├── index.vue              # Home/landing
│   ├── login.vue              # Login page
│   ├── dashboard.vue          # Job catalogue + automation control
│   ├── review.vue             # Review queue (inbox-style)
│   └── settings.vue           # Profile, targeting, LinkedIn auth
│
├── types/                     # TypeScript types
│   ├── job.ts                 # Job-related types
│   ├── profile.ts             # Profile types
│   └── automation.ts          # Automation types
│
├── .env.example               # Environment variables template
├── nuxt.config.ts             # Nuxt configuration
├── package.json               # Dependencies
└── README.md                  # This file
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` — Postgres connection string (Neon)
- `STEEL_API_KEY` — Steel.dev API key (cloud browser)
- `OPENAI_API_KEY` — OpenAI API key for GPT-4o mini
- `TAVILY_API_KEY` — Tavily API key for web search
- `SUPABASE_*` — Supabase credentials for file storage
- `ENCRYPT_SECRET` — 32-byte hex string for AES-256 encryption
- `NUXT_SESSION_SECRET` — Session secret for auth

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Create database tables
npm run prisma:migrate
```

### 4. Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Key Features

- **LinkedIn Automation** — Playwright + Steel.dev fills and submits Easy Apply forms
- **Job Catalogue** — Track all applications with searchable cards
- **Review Queue** — Flag screening questions (relocation, custom) for user confirmation
- **AI Enrichment** — Extract salary from descriptions, generate company summaries via GPT-4o mini
- **Daily Quota** — 30 applications/day with 20 auto-apply + 10 confirmed slots
- **Session Management** — Handle 2FA, detect session expiry, re-auth prompts
- **Filtering** — By status, company, salary, keywords

## API Routes

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Profile
- `GET /api/profile` — Fetch user profile
- `PUT /api/profile` — Update profile
- `POST /api/profile/resume` — Upload resume

### Jobs
- `GET /api/jobs` — List job cards
- `GET /api/jobs/[id]` — Single job card
- `PATCH /api/jobs/[id]` — Update status

### Automation
- `POST /api/automation/start` — Start session
- `POST /api/automation/stop` — Stop session
- `GET /api/automation/status` — Current status + quota
- `POST /api/automation/linkedin-auth` — LinkedIn login
- `POST /api/automation/linkedin-auth/verify` — Submit 2FA code

### Review Queue
- `GET /api/review` — List pending reviews
- `PATCH /api/review/[id]` — Confirm or skip

### AI
- `POST /api/ai/salary` — Parse salary from description
- `POST /api/ai/company` — Get/cache company summary

## Services

### `automation.service.ts`
Main worker loop that:
1. Checks quota and stop flag
2. Fetches jobs from LinkedIn
3. Detects screening questions
4. Fills and submits Easy Apply
5. Saves job + runs AI enrichment
6. Delays 3–8 seconds before next job

### `linkedin.service.ts`
Playwright integration with Steel.dev for:
- Cloud browser session management
- Login with 2FA handling
- Job search and filtering
- Easy Apply form detection and submission
- Randomized delays to avoid bot detection

### `screening.service.ts`
Detects:
- Relocation questions
- Custom open-ended screening questions
- Flags jobs to review queue

### `ai.service.ts`
- Salary extraction from job descriptions
- Company summary generation + caching via Tavily + GPT-4o mini
- Non-blocking async enrichment

### `quota.service.ts`
- Daily quota tracking (30/day limit)
- Auto-apply vs. confirmed-apply counters
- Midnight reset logic

## Database Schema

### Users & Profile
- `users` — User account
- `candidate_profile` — Profile + targeting + automation settings

### Jobs
- `jobs` — Applied jobs
- `company_cache` — Cached company summaries
- `review_queue` — Flagged jobs awaiting user action

### Quota
- `daily_quota` — Daily application counters

## Development TODOs

Each service and API route has `TODO` comments marking:
- Steel.dev browser session creation/release
- Playwright login and form filling
- Job search and Easy Apply logic
- LinkedIn 2FA handling
- Database queries
- API integrations

Search for `TODO` to see all implementation points.

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

Steel.dev will handle cloud browser infrastructure — no binary needed on Vercel.

## Notes

- LinkedIn password is never stored (discarded after login)
- Session cookies are AES-256 encrypted in the database
- All timestamps are user's local time
- Job deduplication via `(user_id, linkedin_job_id)` unique constraint
- Salary parsing is strict — only explicit amounts are extracted
