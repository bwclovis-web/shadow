import { cookies } from 'next/headers'
import { verifyAccessToken, createAccessToken, createRefreshToken } from './tokens'
import { getUserById } from '@/models/user.query'

export async function getSession() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value

  if (!accessToken) {
    return null
  }

  try {
    const payload = verifyAccessToken(accessToken)
    if (!payload) return null

    const user = await getUserById(payload.userId)
    return { user, userId: payload.userId }
  } catch {
    return null
  }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}