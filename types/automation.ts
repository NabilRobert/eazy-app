export interface AutomationStatus {
  running: boolean
  quota: {
    auto: number
    confirmed: number
    total: number
  }
  status: string
  error?: string
}

export interface StartAutomationRequest {
  // empty - uses user's profile settings
}

export interface StopAutomationRequest {
  // empty - just stops current session
}

export interface LinkedinAuthRequest {
  email: string
  password: string
}

export interface LinkedinAuthVerifyRequest {
  code: string
}

export interface LinkedinAuthResponse {
  status: 'pending_2fa' | 'authenticated' | 'expired' | 'error'
  message?: string
}

export interface DailyQuota {
  autoApplied: number
  confirmedApplied: number
  totalApplied: number
  limit: number // 30
}
