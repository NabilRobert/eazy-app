import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import axios from 'axios'

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
   * Search for jobs based on filters
   */
  async searchJobs(_filters: any): Promise<any[]> {
    // TODO: Implement job search:
    // 1. Navigate to LinkedIn jobs search
    // 2. Apply filters (title, location, job type, etc.)
    // 3. Extract job listings
    // 4. Return array of jobs
    return []
  }

  /**
   * Open Easy Apply form
   */
  async openEasyApply(_jobUrl: string): Promise<any> {
    // TODO: Navigate to job and open Easy Apply modal
  }

  /**
   * Fill Easy Apply form with pre-filled answers
   */
  async fillEasyApplyForm(_answers: Record<string, string>): Promise<void> {
    // TODO: Fill form fields with provided answers
  }

  /**
   * Submit Easy Apply form
   */
  async submitEasyApply(): Promise<boolean> {
    // TODO: Click submit button
    // Return true on success
    return false
  }

  /**
   * Detect screening questions
   */
  async detectScreeningQuestions(): Promise<string[]> {
    // TODO: Check for relocation question
    // TODO: Check for custom open-ended questions
    // Return array of detected question types
    return []
  }

  /**
   * Randomized delay between 3-8 seconds
   */
  async randomDelay(): Promise<void> {
    const delay = Math.random() * 5000 + 3000 // 3-8 seconds
    await new Promise(resolve => setTimeout(resolve, delay))
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
