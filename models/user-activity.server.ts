import { prisma } from "@/lib/db"

const TOUCH_THROTTLE_MS = 5 * 60 * 1000

const isWithinThrottle = (lastActiveAt: Date | null | undefined, now: number) =>
  Boolean(
    lastActiveAt && now - lastActiveAt.getTime() < TOUCH_THROTTLE_MS
  )

/**
 * Updates `lastActiveAt` at most once per throttle window.
 * When `lastActiveAtHint` is provided (e.g. from the auth session row), skips the
 * findUnique on the common throttled path.
 */
export const touchUserLastActive = async (
  userId: string,
  lastActiveAtHint?: Date | null
): Promise<void> => {
  const now = Date.now()

  if (lastActiveAtHint !== undefined) {
    if (isWithinThrottle(lastActiveAtHint, now)) {
      return
    }
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveAt: true },
  })
  if (!user) return

  if (isWithinThrottle(user.lastActiveAt, now)) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  })
}
