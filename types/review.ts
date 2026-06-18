/** A pending review-queue item as shown in the inbox (flattened with job info). */
export interface ReviewItem {
  id: string
  reason: string
  jobId?: string
  title: string
  company: string
  location?: string
  description?: string
  jobUrl?: string
  createdAt?: string
}
