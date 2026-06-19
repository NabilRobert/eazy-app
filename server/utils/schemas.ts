import { z } from 'zod'

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required')
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

// --- LinkedIn auth ---
export const linkedinAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required')
})

export const verifyCodeSchema = z.object({
  code: z.string().min(1, 'Verification code is required')
})

// --- Jobs / review ---
export const jobStatusSchema = z.object({
  status: z.enum(['applied', 'interview', 'offer', 'rejected', 'withdrawn'])
})

export const reviewActionSchema = z.object({
  action: z.enum(['confirm', 'skip'])
})

// --- AI ---
export const aiSalarySchema = z.object({
  description: z.string().min(1, 'description is required')
})

export const aiCompanySchema = z.object({
  company: z.string().min(1, 'company is required')
})

// --- Profile update (all fields optional; unknown keys stripped) ---
export const profileUpdateSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinEmail: z.string().email().optional(),
  yearsExperience: z.number().int().nonnegative().nullable().optional(),
  education: z.string().optional(),
  skills: z.array(z.string()).optional(),
  desiredPosition: z.string().optional(),
  preferredLocation: z.string().optional(),
  employmentType: z.string().optional(),
  minSalary: z.number().int().nonnegative().nullable().optional(),
  jobSort: z.enum(['recent', 'relevant']).optional(),
  strictExperience: z.boolean().optional(),
  strictDegree: z.boolean().optional(),
  prefilledAnswers: z.record(z.string()).optional(),
  triggerType: z.enum(['manual', 'scheduled']).optional(),
  scheduledTime: z.string().nullable().optional()
})
