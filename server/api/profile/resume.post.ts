import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { uploadResume } from '~/server/utils/supabase'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/profile/resume  (multipart form-data, field "resume")
 * Upload the candidate's resume PDF to Supabase Storage and save its path.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'resume' && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No resume file uploaded' })
  }
  if (file.type && !file.type.includes('pdf')) {
    throw createError({ statusCode: 400, statusMessage: 'Resume must be a PDF' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Resume must be under 5MB' })
  }

  const path = await uploadResume(user.id, file.data)
  await prisma.candidateProfile.update({ where: { userId: user.id }, data: { resumeUrl: path } })

  return { success: true, data: { resumeUrl: path } }
})
