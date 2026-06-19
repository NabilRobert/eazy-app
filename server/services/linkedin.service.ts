import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import axios from 'axios'
import { ScreeningService } from './screening.service'

const STEEL_API_BASE = 'https://api.steel.dev'
const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login'

/**
 * Result returned by login() / submit2FACode().
 * - `authenticated`: cookies are populated and ready to encrypt/store.
 * - `pending_2fa`: LinkedIn is asking for a verification code; keep the Steel
 *   session alive and call submit2FACode() with the user-supplied code.
 * - `error`: login failed (bad credentials, captcha, unexpected page).
 */
export interface LinkedinAuthResult {
  status: 'authenticated' | 'pending_2fa' | 'error'
  cookies?: SerializedCookie[]
  message?: string
  /** Steel session id — persist this so the 2FA step can resume the session. */
  sessionId?: string
}

export interface SerializedCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}

/** Inputs for a LinkedIn job search, derived from the candidate profile. */
export interface JobSearchFilters {
  /** Title / role keywords, e.g. "Frontend Developer". */
  keywords: string
  /** Preferred job location (may differ from the user's actual location). */
  location?: string
  /** full-time | part-time | contract | temporary | internship | remote. */
  employmentType?: string
  /** Result ordering: most recent vs most relevant. */
  sort?: 'recent' | 'relevant'
  /** Max number of listings to collect (defaults to 25). */
  limit?: number
}

/**
 * A job as seen in the search results list. Description/salary are not
 * available here — they are fetched later when the Easy Apply view is opened.
 */
export interface SearchedJob {
  linkedinJobId: string
  title: string
  company: string
  location: string
  jobUrl: string
}

/**
 * Full detail scraped from a single job posting (used for storage + AI
 * enrichment). Salary fields are populated only when LinkedIn shows a
 * structured compensation value; otherwise they stay null for AI parsing.
 */
export interface JobDetail {
  linkedinJobId: string
  title: string
  company: string
  location: string
  employmentType: string
  postedDate: string
  description: string
  salaryMin: number | null
  salaryMax: number | null
  jobUrl: string
}

/** Result of opening the Easy Apply modal for a job. */
export interface OpenApplyResult {
  opened: boolean
  detail: JobDetail | null
  message?: string
}

/** Result of filling (but not submitting) the Easy Apply form. */
export interface FillResult {
  /** ready_to_submit: advanced to the review/submit step with no gaps. */
  status: 'ready_to_submit' | 'incomplete' | 'error'
  /** Labels of fields we could not confidently fill — feed to screening. */
  unfilledFields: string[]
  /** Number of modal "Next/Review" steps advanced. */
  stepsAdvanced: number
  message?: string
}

/**
 * Service for LinkedIn automation via Playwright + Steel.dev
 */
export class LinkedinService {
  private steelApiKey: string
  private browserUrl?: string
  private sessionId?: string
  private browser?: Browser
  private context?: BrowserContext
  private page?: Page

  constructor(steelApiKey: string) {
    this.steelApiKey = steelApiKey
  }

  /** Steel session id for the currently open browser (if any). */
  getSessionId(): string | undefined {
    return this.sessionId
  }

  async createSession(): Promise<void> {
    try {
      const response = await axios.post(
        `${STEEL_API_BASE}/sessions`,
        {},
        { headers: { 'Steel-Api-Key': this.steelApiKey } }
      )

      const { id, websocket_url } = response.data

      if (!websocket_url) {
        throw new Error('Steel.dev did not return a WebSocket endpoint')
      }

      this.sessionId = id
      this.browserUrl = websocket_url
      console.log(`[Steel] Session created: ${this.sessionId}`)
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.message ?? err.message

      if (status === 401) throw new Error(`[Steel] Invalid API key: ${message}`)
      if (status === 503) throw new Error(`[Steel] Service unavailable: ${message}`)
      throw new Error(`[Steel] Failed to create session: ${message}`)
    }
  }

  async connectPlaywright(): Promise<Browser> {
    if (!this.browserUrl) {
      throw new Error('Browser session not created. Call createSession first.')
    }

    try {
      const browser = await chromium.connectOverCDP(this.browserUrl)
      this.browser = browser
      console.log(`[Steel] Playwright connected via CDP: ${this.browserUrl}`)
      return browser
    } catch (err: any) {
      throw new Error(`[Steel] CDP connection failed: ${err.message}`)
    }
  }

  /**
   * Ensure we have a connected browser, context, and page ready to drive.
   * Reuses Steel's default context/page so navigation state survives across
   * the multiple calls of the login → 2FA flow.
   */
  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page

    if (!this.browser) {
      if (!this.browserUrl) await this.createSession()
      await this.connectPlaywright()
    }

    // Steel exposes the cloud browser's existing context over CDP; reuse it so
    // cookies set during login persist for cookie extraction.
    this.context = this.browser!.contexts()[0] ?? (await this.browser!.newContext())
    this.page = this.context.pages()[0] ?? (await this.context.newPage())
    return this.page
  }

  /** Serialize the current browser context's cookies for encrypted storage. */
  private async extractCookies(): Promise<SerializedCookie[]> {
    if (!this.context) throw new Error('No browser context to read cookies from.')
    const cookies = await this.context.cookies()
    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite as 'Strict' | 'Lax' | 'None'
    }))
  }

  /**
   * Inspect the current page to decide whether login succeeded, needs 2FA,
   * or failed. Uses URL + DOM signals because LinkedIn varies its markup.
   */
  private async detectAuthState(): Promise<'authenticated' | 'pending_2fa' | 'error'> {
    const page = this.page!
    const url = page.url()

    // 2FA / checkpoint: URL contains checkpoint/challenge, or a PIN input exists.
    if (/checkpoint\/challenge|\/checkpoint\//.test(url)) return 'pending_2fa'
    const pinInput = page.locator(
      'input#input__phone_verification_pin, input[name="pin"], input[autocomplete="one-time-code"]'
    )
    if (await pinInput.count()) return 'pending_2fa'

    // Success: redirected to the authenticated app (feed/home), global nav present.
    if (/\/feed\/?|\/checkpoint\/lg\/login-submit|linkedin\.com\/?($|\?)/.test(url)) {
      const loggedIn = await page
        .locator('header.global-nav, #global-nav, [data-test-global-nav]')
        .count()
      if (loggedIn || /\/feed/.test(url)) return 'authenticated'
    }

    // Still on a login/error page.
    return 'error'
  }

  /**
   * Restore a saved LinkedIn session: connect, inject the stored cookies, and
   * navigate to the feed to confirm the session is still valid. Returns false
   * if LinkedIn bounces to the login page (session expired).
   */
  async loadSession(cookies: SerializedCookie[]): Promise<boolean> {
    try {
      const page = await this.ensurePage()
      if (cookies?.length && this.context) {
        await this.context.addCookies(cookies)
      }
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500)

      const state = await this.detectAuthState()
      const ok = state === 'authenticated'
      if (!ok) console.warn('[LinkedIn] Restored session is not authenticated (expired)')
      return ok
    } catch (err: any) {
      console.error(`[LinkedIn] loadSession failed: ${err.message}`)
      return false
    }
  }

  /** Read any visible login error message LinkedIn surfaces. */
  private async readLoginError(): Promise<string | undefined> {
    const page = this.page!
    const selectors = ['#error-for-password', '#error-for-username', '.alert.error', '[error-for]']
    for (const sel of selectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        const text = (await el.textContent())?.trim()
        if (text) return text
      }
    }
    return undefined
  }

  /**
   * Login to LinkedIn with email/password.
   *
   * The password is used only to fill the form and is never retained on the
   * instance or returned. On success cookies are extracted for encrypted
   * storage; if LinkedIn challenges with 2FA the Steel session is left open so
   * submit2FACode() can complete the flow.
   */
  async login(email: string, password: string): Promise<LinkedinAuthResult> {
    try {
      const page = await this.ensurePage()

      await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Fill credentials. LinkedIn's login form uses #username / #password.
      await page.fill('input#username', email, { timeout: 15000 })
      await page.fill('input#password', password, { timeout: 15000 })

      // Submit and wait for the resulting navigation to settle.
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}),
        page.click('button[type="submit"]', { timeout: 15000 })
      ])
      // Give client-side redirects (feed / checkpoint) a moment to resolve.
      await page.waitForTimeout(2500)

      const state = await this.detectAuthState()

      if (state === 'pending_2fa') {
        console.log('[LinkedIn] 2FA challenge detected — awaiting verification code')
        return { status: 'pending_2fa', sessionId: this.sessionId }
      }

      if (state === 'authenticated') {
        const cookies = await this.extractCookies()
        console.log('[LinkedIn] Login successful — extracted session cookies')
        return { status: 'authenticated', cookies, sessionId: this.sessionId }
      }

      const message = (await this.readLoginError()) ?? 'Login failed — check credentials or try again.'
      console.warn(`[LinkedIn] Login error: ${message}`)
      return { status: 'error', message, sessionId: this.sessionId }
    } catch (err: any) {
      console.error(`[LinkedIn] Login threw: ${err.message}`)
      return { status: 'error', message: `Login failed: ${err.message}`, sessionId: this.sessionId }
    }
  }

  /**
   * Submit a 2FA verification code on the existing challenge page.
   * Must be called on the same Steel session that returned `pending_2fa`.
   */
  async submit2FACode(code: string): Promise<LinkedinAuthResult> {
    try {
      if (!this.page || this.page.isClosed()) {
        throw new Error('No active 2FA session. The login challenge has expired — restart login.')
      }
      const page = this.page

      const pinInput = page
        .locator(
          'input#input__phone_verification_pin, input[name="pin"], input[autocomplete="one-time-code"]'
        )
        .first()
      await pinInput.waitFor({ state: 'visible', timeout: 15000 })
      await pinInput.fill(code)

      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}),
        page.click('button#two-step-submit-button, button[type="submit"]', { timeout: 15000 })
      ])
      await page.waitForTimeout(2500)

      const state = await this.detectAuthState()

      if (state === 'authenticated') {
        const cookies = await this.extractCookies()
        console.log('[LinkedIn] 2FA verified — extracted session cookies')
        return { status: 'authenticated', cookies, sessionId: this.sessionId }
      }

      if (state === 'pending_2fa') {
        return {
          status: 'pending_2fa',
          message: 'Verification code was rejected. Please re-enter the code.',
          sessionId: this.sessionId
        }
      }

      const message = (await this.readLoginError()) ?? '2FA verification failed.'
      return { status: 'error', message, sessionId: this.sessionId }
    } catch (err: any) {
      console.error(`[LinkedIn] 2FA submission threw: ${err.message}`)
      return { status: 'error', message: `2FA verification failed: ${err.message}`, sessionId: this.sessionId }
    }
  }

  /**
   * Map a human employment type to LinkedIn's f_JT job-type code.
   * Returns null for "remote" (handled separately via f_WT) or unknowns.
   */
  private static employmentTypeCode(type?: string): string | null {
    if (!type) return null
    switch (type.toLowerCase().replace(/[\s_-]/g, '')) {
      case 'fulltime':
        return 'F'
      case 'parttime':
        return 'P'
      case 'contract':
        return 'C'
      case 'temporary':
        return 'T'
      case 'internship':
        return 'I'
      case 'volunteer':
        return 'V'
      default:
        return null
    }
  }

  /**
   * Build a LinkedIn jobs search URL. Always constrains to Easy Apply
   * (`f_AL=true`) since this bot only applies to Easy Apply postings.
   */
  private buildSearchUrl(filters: JobSearchFilters): string {
    const params = new URLSearchParams()
    params.set('keywords', filters.keywords)
    if (filters.location) params.set('location', filters.location)
    params.set('f_AL', 'true') // Easy Apply only
    params.set('sortBy', filters.sort === 'relevant' ? 'R' : 'DD') // DD = date desc

    const jt = LinkedinService.employmentTypeCode(filters.employmentType)
    if (jt) params.set('f_JT', jt)
    if (filters.employmentType?.toLowerCase().includes('remote')) params.set('f_WT', '2')

    return `https://www.linkedin.com/jobs/search/?${params.toString()}`
  }

  /**
   * Search LinkedIn for jobs matching the given filters and return the
   * listing rows (id, title, company, location, url). Scrolls the results
   * pane to lazy-load additional cards up to `limit`.
   */
  async searchJobs(filters: JobSearchFilters): Promise<SearchedJob[]> {
    const limit = filters.limit ?? 25
    try {
      const page = await this.ensurePage()
      const url = this.buildSearchUrl(filters)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for either the authenticated results list or the public list.
      await page
        .locator(
          '.scaffold-layout__list, ul.jobs-search__results-list, .jobs-search-results-list, [data-results-list-top-scroll-sentinel]'
        )
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
        .catch(() => {})

      // Lazy-load: LinkedIn appends cards as the results pane scrolls.
      const collected = new Map<string, SearchedJob>()
      let stagnantPasses = 0
      for (let pass = 0; pass < 12 && collected.size < limit && stagnantPasses < 3; pass++) {
        const batch = await this.extractJobCards(page)
        const before = collected.size
        for (const job of batch) {
          if (!collected.has(job.linkedinJobId)) collected.set(job.linkedinJobId, job)
        }
        stagnantPasses = collected.size === before ? stagnantPasses + 1 : 0

        // Scroll the list to trigger loading the next page of cards.
        await page.evaluate(() => {
          const list = document.querySelector(
            '.scaffold-layout__list, ul.jobs-search__results-list, .jobs-search-results-list'
          )
          if (list) list.scrollBy(0, list.clientHeight)
          else window.scrollBy(0, window.innerHeight)
        })
        await page.waitForTimeout(1200)
      }

      const jobs = Array.from(collected.values()).slice(0, limit)
      console.log(`[LinkedIn] searchJobs collected ${jobs.length} listing(s) for "${filters.keywords}"`)
      return jobs
    } catch (err: any) {
      console.error(`[LinkedIn] searchJobs failed: ${err.message}`)
      return []
    }
  }

  /**
   * Extract the currently-rendered job cards from the search results DOM.
   * Defensive against LinkedIn's varying authenticated/public markup.
   */
  private async extractJobCards(page: Page): Promise<SearchedJob[]> {
    return page.evaluate(() => {
      const out: Array<{ linkedinJobId: string; title: string; company: string; location: string; jobUrl: string }> = []
      const seen = new Set<string>()

      const cards = document.querySelectorAll(
        'li[data-occludable-job-id], div.job-card-container, li.jobs-search-results__list-item, ul.jobs-search__results-list > li'
      )

      cards.forEach((card) => {
        const link = card.querySelector<HTMLAnchorElement>(
          'a.job-card-container__link, a.job-card-list__title, a.base-card__full-link, a[href*="/jobs/view/"]'
        )
        const href = link?.href || ''
        const idAttr =
          card.getAttribute('data-occludable-job-id') ||
          card.getAttribute('data-job-id') ||
          (href.match(/\/jobs\/view\/(\d+)/)?.[1] ?? '')
        if (!idAttr || seen.has(idAttr)) return

        const text = (sel: string) => {
          const el = card.querySelector(sel)
          return el?.textContent?.replace(/\s+/g, ' ').trim() || ''
        }

        const title =
          link?.getAttribute('aria-label')?.trim() ||
          text('.job-card-list__title') ||
          text('.job-card-container__link') ||
          text('.base-search-card__title') ||
          text('strong') ||
          (link?.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        const company =
          text('.job-card-container__primary-description') ||
          text('.artdeco-entity-lockup__subtitle') ||
          text('.base-search-card__subtitle') ||
          text('.job-card-container__company-name')
        const location =
          text('.job-card-container__metadata-item') ||
          text('.artdeco-entity-lockup__caption') ||
          text('.job-search-card__location')

        const jobUrl = href ? href.split('?')[0] : `https://www.linkedin.com/jobs/view/${idAttr}/`

        seen.add(idAttr)
        out.push({ linkedinJobId: idAttr, title, company, location, jobUrl })
      })

      return out
    })
  }

  /**
   * Navigate to a job posting and scrape its detail WITHOUT opening the Easy
   * Apply modal. Lets the brain decide apply/skip before we touch the form
   * (cheaper + less bot-detectable). Returns null on failure.
   */
  async scrapeJobDetail(jobUrl: string): Promise<JobDetail | null> {
    try {
      const page = await this.ensurePage()
      await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500)
      return await this.extractJobDetail(page, jobUrl)
    } catch (err: any) {
      console.error(`[LinkedIn] scrapeJobDetail failed: ${err.message}`)
      return null
    }
  }

  /**
   * Open the Easy Apply modal on the currently-loaded job page. Returns false
   * when there's no Easy Apply button (external apply) or it fails to open.
   */
  async openApplyModal(): Promise<boolean> {
    try {
      const page = this.page
      if (!page || page.isClosed()) return false
      const applyBtn = page
        .locator('button.jobs-apply-button, button[aria-label*="Easy Apply" i]')
        .first()
      if (!(await applyBtn.count())) return false
      await applyBtn.click({ timeout: 10000 }).catch(() => {})

      const modal = page.locator('div[role="dialog"], .jobs-easy-apply-modal').first()
      await modal.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
      return (await modal.count()) > 0
    } catch (err: any) {
      console.error(`[LinkedIn] openApplyModal failed: ${err.message}`)
      return false
    }
  }

  /** Scrape title/company/location/description/type/date/salary from a job page. */
  private async extractJobDetail(page: Page, jobUrl: string): Promise<JobDetail> {
    const idMatch = jobUrl.match(/\/jobs\/view\/(\d+)/)
    const linkedinJobId = idMatch?.[1] ?? ''

    const raw = await page.evaluate(() => {
      const t = (sel: string) => {
        const el = document.querySelector(sel)
        return el?.textContent?.replace(/\s+/g, ' ').trim() || ''
      }
      const title =
        t('.job-details-jobs-unified-top-card__job-title') ||
        t('.jobs-unified-top-card__job-title') ||
        t('h1')
      const company =
        t('.job-details-jobs-unified-top-card__company-name') ||
        t('.jobs-unified-top-card__company-name') ||
        t('.jobs-unified-top-card__primary-description a')
      const primary =
        t('.job-details-jobs-unified-top-card__primary-description-container') ||
        t('.jobs-unified-top-card__primary-description') ||
        t('.jobs-unified-top-card__subtitle-primary-grouping')
      const description =
        t('#job-details') ||
        t('.jobs-description__content') ||
        t('.jobs-box__html-content') ||
        t('.show-more-less-html__markup')
      // Insight chips usually hold employment type + salary if present.
      const insights = Array.from(
        document.querySelectorAll(
          '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight, li.job-details-jobs-unified-top-card__job-insight span'
        )
      )
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
        .filter(Boolean)
      return { title, company, primary, description, insights }
    })

    // Employment type from insight chips.
    const typeRe = /(full-?time|part-?time|contract|temporary|internship|volunteer)/i
    const employmentType =
      raw.insights.map((s: string) => s.match(typeRe)?.[0]).find(Boolean)?.toString() ?? ''

    // Posted date: pull a "x days/weeks ago"-style phrase from the header.
    const postedDate = raw.primary.match(/(\d+\s+(?:minute|hour|day|week|month)s?\s+ago|just now)/i)?.[0] ?? ''

    // Structured salary: only if an insight chip shows a currency range.
    const salaryChip = raw.insights.find((s: string) => /[$€£₹]|\bIDR\b|\bRp\b|\/(yr|hr|month)/i.test(s)) ?? ''
    const nums = salaryChip.match(/[\d.,]+\s*[KkMm]?/g)?.map((n) => this.parseMoney(n)) ?? []
    const salaryMin = nums.length ? Math.min(...nums) : null
    const salaryMax = nums.length ? Math.max(...nums) : null

    const location = raw.primary.split('·')[0]?.trim() || ''

    return {
      linkedinJobId,
      title: raw.title,
      company: raw.company,
      location,
      employmentType,
      postedDate,
      description: raw.description,
      salaryMin,
      salaryMax,
      jobUrl
    }
  }

  /** Parse a money token like "120,000", "$95K", "1.2M" into a number. */
  private parseMoney(token: string): number {
    const cleaned = token.replace(/[^0-9.kKmM]/g, '')
    const mult = /[kK]/.test(cleaned) ? 1_000 : /[mM]/.test(cleaned) ? 1_000_000 : 1
    return Math.round(parseFloat(cleaned.replace(/[kKmM]/g, '')) * mult)
  }

  /**
   * Fill the Easy Apply form across its multi-step modal using `answers`
   * (a normalized question/label -> value map built from the candidate
   * profile + prefilled answers). Advances Next/Review until the Submit
   * step is reached, but does NOT submit (that is Step #6). Returns any
   * labels left unfilled so screening detection can flag them.
   */
  async fillEasyApplyForm(answers: Record<string, string>): Promise<FillResult> {
    try {
      const page = this.page
      if (!page || page.isClosed()) {
        return { status: 'error', unfilledFields: [], stepsAdvanced: 0, message: 'No active page.' }
      }
      const modal = page.locator('div[role="dialog"], .jobs-easy-apply-modal').first()
      if (!(await modal.count())) {
        return { status: 'error', unfilledFields: [], stepsAdvanced: 0, message: 'Easy Apply modal not open.' }
      }

      const unfilled = new Set<string>()
      let stepsAdvanced = 0

      for (let step = 0; step < 12; step++) {
        const missed = await this.fillCurrentStep(modal, answers)
        missed.forEach((m) => unfilled.add(m))

        // Submit available => we're on the review step; stop here for Step #6.
        const submitBtn = modal.locator('button[aria-label*="Submit application" i]')
        if (await submitBtn.count()) {
          return { status: 'ready_to_submit', unfilledFields: [...unfilled], stepsAdvanced }
        }

        const nextBtn = modal
          .locator('button[aria-label*="Continue to next step" i], button[aria-label*="Review" i], button[aria-label*="Next" i]')
          .first()
        if (!(await nextBtn.count())) break

        await nextBtn.click({ timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(900)
        stepsAdvanced++
      }

      return {
        status: unfilled.size ? 'incomplete' : 'ready_to_submit',
        unfilledFields: [...unfilled],
        stepsAdvanced
      }
    } catch (err: any) {
      console.error(`[LinkedIn] fillEasyApplyForm failed: ${err.message}`)
      return { status: 'error', unfilledFields: [], stepsAdvanced: 0, message: err.message }
    }
  }

  /**
   * Fill every form group in the currently-visible modal step. Returns the
   * labels of fields that had no matching answer (potential screening items).
   */
  private async fillCurrentStep(
    modal: ReturnType<Page['locator']>,
    answers: Record<string, string>
  ): Promise<string[]> {
    const missed: string[] = []
    const groups = modal.locator('.fb-dash-form-element, .jobs-easy-apply-form-section__grouping, fieldset[data-test-form-builder-radio-button-form-component]')
    const count = await groups.count()

    for (let i = 0; i < count; i++) {
      const group = groups.nth(i)
      const label = (
        (await group.locator('label, legend').first().textContent().catch(() => '')) ?? ''
      )
        .replace(/\s+/g, ' ')
        .trim()
      if (!label) continue

      const value = this.matchAnswer(label, answers)

      // Select dropdown.
      const select = group.locator('select')
      if (await select.count()) {
        if (value) {
          await select.selectOption({ label: value }).catch(async () => {
            await select.selectOption(value).catch(() => missed.push(label))
          })
        } else {
          missed.push(label)
        }
        continue
      }

      // Radio group (e.g. Yes/No screening, work authorization).
      const radios = group.locator('input[type="radio"]')
      if (await radios.count()) {
        if (value) {
          const choice = group.locator(`label:has-text("${value}")`).first()
          if (await choice.count()) await choice.click().catch(() => missed.push(label))
          else missed.push(label)
        } else {
          missed.push(label)
        }
        continue
      }

      // Textarea.
      const textarea = group.locator('textarea')
      if (await textarea.count()) {
        if (value) await textarea.fill(value).catch(() => missed.push(label))
        else missed.push(label)
        continue
      }

      // Plain text/email/tel input.
      const input = group.locator('input[type="text"], input[type="email"], input[type="tel"], input:not([type])')
      if (await input.count()) {
        if (value) await input.first().fill(value).catch(() => missed.push(label))
        else missed.push(label)
        continue
      }
    }

    return missed
  }

  /**
   * Match a form label to a value. Tries direct/substring matches against
   * the answer map plus a few standard contact synonyms.
   */
  private matchAnswer(label: string, answers: Record<string, string>): string | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const nLabel = norm(label)

    for (const [key, val] of Object.entries(answers)) {
      const nKey = norm(key)
      if (!nKey || !val) continue
      if (nLabel === nKey || nLabel.includes(nKey) || nKey.includes(nLabel)) return val
    }

    // Common contact-field synonyms, sourced from standard answer keys.
    const synonyms: Record<string, string[]> = {
      fullname: ['name', 'fullname', 'firstandlastname'],
      email: ['email', 'emailaddress'],
      phone: ['phone', 'mobile', 'phonenumber', 'mobilephonenumber'],
      location: ['city', 'location'],
      expectedsalary: ['expectedsalary', 'salaryexpectation', 'desiredsalary'],
      currentsalary: ['currentsalary', 'presentsalary'],
      noticeperiod: ['noticeperiod', 'noticedays']
    }
    for (const [answerKey, labels] of Object.entries(synonyms)) {
      if (labels.some((l) => nLabel.includes(l))) {
        const hit = Object.entries(answers).find(([k]) => norm(k) === answerKey || labels.includes(norm(k)))
        if (hit?.[1]) return hit[1]
      }
    }

    return undefined
  }

  /**
   * Submit the Easy Apply application from the review step. Clicks Submit,
   * confirms the "application was sent" state, and dismisses the post-submit
   * dialog. Returns true on confirmed success.
   */
  async submitEasyApply(): Promise<boolean> {
    try {
      const page = this.page
      if (!page || page.isClosed()) return false

      const modal = page.locator('div[role="dialog"], .jobs-easy-apply-modal').first()
      const submitBtn = modal.locator('button[aria-label*="Submit application" i]').first()
      if (!(await submitBtn.count())) {
        console.warn('[LinkedIn] submitEasyApply: no Submit button on current step')
        return false
      }

      await submitBtn.click({ timeout: 10000 })
      await page.waitForTimeout(2000)

      // Success signal: a confirmation dialog, or the apply modal is gone.
      const confirmation = page.locator(
        ':text("application was sent"), :text("Your application was sent"), :text("Application sent")'
      )
      const ok = (await confirmation.count()) > 0 || (await modal.count()) === 0

      // Dismiss the post-submit dialog (Done / close button) if present.
      const done = page
        .locator('button[aria-label="Dismiss" i], button[aria-label="Done" i], button:has-text("Done")')
        .first()
      if (await done.count()) await done.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(500)

      if (ok) console.log('[LinkedIn] Application submitted successfully')
      else console.warn('[LinkedIn] submitEasyApply: no confirmation detected')
      return ok
    } catch (err: any) {
      console.error(`[LinkedIn] submitEasyApply failed: ${err.message}`)
      return false
    }
  }

  /**
   * Attach a resume PDF to the open Easy Apply modal, if it exposes a file
   * input. Returns false when no upload field is present (LinkedIn often
   * pre-attaches the profile resume, which is fine).
   */
  async attachResume(localPath: string): Promise<boolean> {
    try {
      const page = this.page
      if (!page || page.isClosed()) return false
      const modal = page.locator('div[role="dialog"], .jobs-easy-apply-modal').first()
      const fileInput = modal.locator('input[type="file"]').first()
      if (!(await fileInput.count())) return false
      await fileInput.setInputFiles(localPath)
      await page.waitForTimeout(1500)
      console.log('[LinkedIn] Resume attached')
      return true
    } catch (err: any) {
      console.error(`[LinkedIn] attachResume failed: ${err.message}`)
      return false
    }
  }

  /**
   * Close an in-progress Easy Apply modal, confirming the discard prompt if
   * LinkedIn shows one. Used when a job is skipped or flagged for review.
   */
  async closeApplyModal(): Promise<void> {
    try {
      const page = this.page
      if (!page || page.isClosed()) return

      const dismiss = page.locator('button[aria-label="Dismiss" i]').first()
      if (await dismiss.count()) await dismiss.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(400)

      const discard = page
        .locator('button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")')
        .first()
      if (await discard.count()) await discard.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
    } catch {
      /* best-effort */
    }
  }

  /**
   * Inspect the open Easy Apply modal for questions that require user review.
   * Returns review-queue reason codes (e.g. 'relocation_question',
   * 'custom_screening'). Pass the candidate's prefilled answers so standard,
   * auto-answerable questions are not mistaken for custom screening.
   */
  async detectScreeningQuestions(
    prefilledAnswers: Record<string, string> = {}
  ): Promise<{ reasons: string[]; questions: string[] }> {
    try {
      const page = this.page
      if (!page || page.isClosed()) return { reasons: [], questions: [] }
      const modal = page.locator('div[role="dialog"], .jobs-easy-apply-modal').first()
      if (!(await modal.count())) return { reasons: [], questions: [] }

      const labels = await this.collectModalLabels(modal)
      const { reasons, customQuestions } = ScreeningService.classifyScreening(labels, prefilledAnswers)
      if (reasons.length) console.log(`[LinkedIn] Screening flags: ${reasons.join(', ')}`)
      return { reasons, questions: customQuestions }
    } catch (err: any) {
      console.error(`[LinkedIn] detectScreeningQuestions failed: ${err.message}`)
      return { reasons: [], questions: [] }
    }
  }

  /** Collect all question label/legend texts from the open modal step. */
  private async collectModalLabels(modal: ReturnType<Page['locator']>): Promise<string[]> {
    return modal.evaluate((root: Element) => {
      const els = root.querySelectorAll(
        'label, legend, .fb-dash-form-element__label, .jobs-easy-apply-form-element__label'
      )
      const set = new Set<string>()
      els.forEach((e) => {
        const t = e.textContent?.replace(/\s+/g, ' ').trim()
        if (t) set.add(t)
      })
      return Array.from(set)
    })
  }

  /**
   * Randomized delay between 3-8 seconds
   */
  async randomDelay(): Promise<void> {
    // Mostly 5–12s between jobs, with an occasional longer "coffee break" to
    // look less robotic and reduce bot-detection risk.
    const coffeeBreak = Math.random() < 0.15
    const delay = coffeeBreak
      ? Math.random() * 20000 + 20000 // 20–40s
      : Math.random() * 7000 + 5000 // 5–12s
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Release Steel.dev session
   */
  async closeSession(): Promise<void> {
    // Disconnect Playwright first so the CDP socket closes cleanly.
    try {
      await this.browser?.close()
    } catch (err: any) {
      console.error(`[Steel] Failed to close Playwright browser: ${err.message}`)
    }

    if (!this.sessionId) {
      this.browser = undefined
      this.context = undefined
      this.page = undefined
      this.browserUrl = undefined
      return
    }

    try {
      await axios.delete(
        `${STEEL_API_BASE}/sessions/${this.sessionId}`,
        { headers: { 'Steel-Api-Key': this.steelApiKey } }
      )
      console.log(`[Steel] Session released: ${this.sessionId}`)
    } catch (err: any) {
      console.error(`[Steel] Failed to release session ${this.sessionId}: ${err.message}`)
    } finally {
      this.sessionId = undefined
      this.browserUrl = undefined
      this.browser = undefined
      this.context = undefined
      this.page = undefined
    }
  }
}

export function createLinkedinService(steelApiKey: string) {
  return new LinkedinService(steelApiKey)
}
