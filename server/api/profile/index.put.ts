import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import type { ProfileUpdateInput } from '~/types/profile'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body: ProfileUpdateInput = await readBody(event)

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
      statusMessage: error.message || 'Failed to update profile'
    })
  }
})
