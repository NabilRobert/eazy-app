export interface Criterion {
  name: string
  verdict: 'pass' | 'partial' | 'fail'
  weight: number
  note: string
}

export interface Decision {
  id: string
  jobTitle: string | null
  company: string | null
  jobUrl: string | null
  decision: 'apply' | 'review' | 'skip'
  score: number | null
  criteria: Criterion[] | unknown
  rationale: string | null
  model: string | null
  promptVersion: string | null
  createdAt: string
}
