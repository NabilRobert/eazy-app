import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { validateBody } from '~/server/utils/validation'
import { profileUpdateSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    // Validated + stripped of unknown keys, so only allowed fields are written.
    const body = await validateBody(event, profileUpdateSchema)

    const profile = await prisma.candidateProfile.update({
      where: { userId: user.id },
      data: {
        ...body,
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: profile
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to update profile'
    })
  }
})
