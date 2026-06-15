import prisma from './prisma'

export async function getUserFromSession(userId: string) {
  if (!userId) {
    return null
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { candidateProfile: true }
    })
    return user
  } catch {
    return null
  }
}

export async function requireAuth(event: any) {
  const user = await requireUserSession(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }
  return user
}

export function requireUserSession(event: any) {
  return getUserSession(event)
}

export async function getUserSession(event: any) {
  const { getHeader } = event.node.req
  const authorization = getHeader('authorization')

  if (!authorization) {
    return null
  }

  const token = authorization.replace('Bearer ', '')

  try {
    // Decode JWT or verify session token here
    // For now, a simple placeholder - implement based on your auth strategy
    return { id: token }
  } catch {
    return null
  }
}
