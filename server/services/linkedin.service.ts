import { chromium, type Browser } from 'playwright'
import axios from 'axios'

const STEEL_API_BASE = 'https://api.steel.dev'

/**
 * Service for LinkedIn automation via Playwright + Steel.dev
 */
export class LinkedinService {
  private steelApiKey: string
  private browserUrl?: string
  private sessionId?: string

  constructor(steelApiKey: string) {
    this.steelApiKey = steelApiKey
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
      console.log(`[Steel] Playwright connected via CDP: ${this.browserUrl}`)
      return browser
    } catch (err: any) {
      throw new Error(`[Steel] CDP connection failed: ${err.message}`)
    }
  }

  /**
   * Login to LinkedIn with email/password
   */
  async login(_email: string, _password: string): Promise<any> {
    // TODO: Implement login flow:
    // 1. Navigate to linkedin.com/login
    // 2. Fill email
    // 3. Fill password
    // 4. Submit
    // 5. Check for 2FA screen
    // 6. Return session cookies or 2FA status
  }

  /**
   * Submit 2FA code
   */
  async submit2FACode(_code: string): Promise<any> {
    // TODO: Fill and submit 2FA code
    // Return session cookies on success
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
    if (!this.sessionId) return

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
    }
  }
}

export function createLinkedinService(steelApiKey: string) {
  return new LinkedinService(steelApiKey)
}
