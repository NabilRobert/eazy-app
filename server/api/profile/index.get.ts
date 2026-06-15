import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Profile not found'
      })
    }

    return {
      success: true,
      data: profile
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch profile'
    })
  }
})
