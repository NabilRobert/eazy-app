export type LinkedinAuthStatus = 'pending_2fa' | 'authenticated' | 'expired'

export type TriggerType = 'manual' | 'scheduled'

export interface CandidateProfile {
  id: string
  userId: string
  fullName: string | null
  phone: string | null
  location: string | null
  linkedinEmail: string | null
  linkedinAuthStatus: LinkedinAuthStatus
  resumeUrl: string | null
  yearsExperience: number | null
  education: string | null
  skills: string[]
  desiredPosition: string | null
  preferredLocation: string | null
  employmentType: string | null
  minSalary: number | null
  jobSort: 'recent' | 'relevant'
  strictExperience: boolean
  strictDegree: boolean
  prefilledAnswers: Record<string, string>
  triggerType: TriggerType
  scheduledTime: string | null
  updatedAt: Date
}

export interface ProfileUpdateInput {
  fullName?: string
  phone?: string
  location?: string
  linkedinEmail?: string
  yearsExperience?: number
  education?: string
  skills?: string[]
  desiredPosition?: string
  preferredLocation?: string
  employmentType?: string
  minSalary?: number | null
  jobSort?: 'recent' | 'relevant'
  strictExperience?: boolean
  strictDegree?: boolean
  prefilledAnswers?: Record<string, string>
  triggerType?: TriggerType
  scheduledTime?: string | null
}
