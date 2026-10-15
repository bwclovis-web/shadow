export type AdParticipationUser = {
  isEarlyAdopter?: boolean | null
  subscriptionStatus?: string | null
}

/**
 * Ads are shown only to viewers who are not participating members
 * (not paid and not early adopters). Anonymous viewers see ads.
 * Mirrors `canParticipate` without importing server/Prisma modules.
 */
export const shouldShowAds = (
  user: AdParticipationUser | null | undefined
): boolean => {
  if (!user) return true
  const participates =
    user.isEarlyAdopter === true || user.subscriptionStatus === "paid"
  return !participates
}

export const isAdSenseEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim())

export const getAdSenseClientId = (): string | undefined => {
  const id = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()
  return id || undefined
}

/** Google certification authority ID for AdSense in ads.txt. */
const GOOGLE_ADS_TXT_CERT_ID = "f08c47fec0942fa0"

/** ads.txt line for the configured publisher, or undefined when unset/invalid. */
export const buildAdsTxtLine = (
  clientId: string | null | undefined
): string | undefined => {
  const match = clientId?.trim().match(/^(?:ca-)?(pub-\d+)$/)
  if (!match) return undefined
  return `google.com, ${match[1]}, DIRECT, ${GOOGLE_ADS_TXT_CERT_ID}`
}

export type AdSenseSlotKind = "display" | "inArticle"

export const getAdSenseSlotId = (kind: AdSenseSlotKind): string | undefined => {
  const key =
    kind === "inArticle"
      ? "NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE"
      : "NEXT_PUBLIC_ADSENSE_SLOT_DISPLAY"
  const id = process.env[key]?.trim()
  return id || undefined
}
