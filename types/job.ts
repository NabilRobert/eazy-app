export type ApplicationStatus = 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export type SalarySource = 'structured' | 'ai_parsed' | 'not_disclosed'

export interface Job {
  id: string
  userId: string
  linkedinJobId: string
  title: string
  company: string
  location: string
  employmentType: string
  postedDate: string
  appliedAt: Date
  status: ApplicationStatus
  salaryMin: number | null
  salaryMax: number | null
  salarySource: SalarySource
  description: string
  jobUrl: string
  needsReview: boolean
  createdAt: Date
}

export interface JobFilters {
  status?: ApplicationStatus
  company?: string
  keyword?: string
  dateRange?: {
    start: Date
    end: Date
  }
}
