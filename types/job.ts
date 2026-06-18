export type ApplicationStatus = 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export type SalarySource = 'structured' | 'ai_parsed' | 'not_disclosed'

export interface Job {
  id: string
  userId: string
  linkedinJobId: string
  title: string
  companyName: string
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

/** Subset of a job shown on a dashboard card. */
export interface JobCard {
  id: string
  title: string
  companyName: string
  location: string
  status: string
  salaryMin?: number
  jobUrl?: string
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
