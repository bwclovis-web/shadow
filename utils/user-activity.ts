/** Users active within this window show the "Recently active" indicator. */
export const RECENTLY_ACTIVE_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const isRecentlyActive = (
  lastActiveAt: Date | string | null | undefined
): boolean => {
  if (!lastActiveAt) return false
  const at = typeof lastActiveAt === "string" ? new Date(lastActiveAt) : lastActiveAt
  if (Number.isNaN(at.getTime())) return false
  return Date.now() - at.getTime() <= RECENTLY_ACTIVE_DAYS * MS_PER_DAY
}
