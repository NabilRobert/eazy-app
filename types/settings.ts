export type LinkedinStatus = 'authenticated' | 'expired' | 'pending_2fa'

export interface ProfileForm {
  fullName: string
  phone: string
  location: string
  yearsExperience: number | null
  education: string
}

export interface TargetingForm {
  desiredPosition: string
  preferredLocation: string
  employmentType: string
  minSalary: number | null
}

export interface AutomationForm {
  triggerType: string
  scheduledTime: string
}

export interface LinkedinFlow {
  open: boolean
  step: 'creds' | '2fa'
  email: string
  password: string
  code: string
  loading: boolean
  error: string
}
