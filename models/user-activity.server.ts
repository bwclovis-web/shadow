import { prisma } from "@/lib/db"

const TOUCH_THROTTLE_MS = 5 * 60 * 1000

/** Updates `lastActiveAt` at most once per throttle window. */
export const touchUserLastActive = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveAt: true },
  })
  if (!user) return

  const now = Date.now()
  if (
    user.lastActiveAt &&
    now - user.lastActiveAt.getTime() < TOUCH_THROTTLE_MS
  ) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  })
}
