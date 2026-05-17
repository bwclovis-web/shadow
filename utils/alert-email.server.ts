import { PERFUME_PATH } from "@/constants/routes"
import type { UserAlertPreferences } from "@/types/database"
import {
  getAppBaseUrl,
  isSendableRecipientEmail,
  sendTransactionalEmail,
} from "@/utils/email.server"
import { getProfilePathForUser, getUserDisplayName } from "@/utils/user"

type AlertPrefsSlice = Pick<
  UserAlertPreferences,
  | "wishlistAlertsEnabled"
  | "decantAlertsEnabled"
  | "emailWishlistAlerts"
  | "emailDecantAlerts"
>

type RecipientUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  profileSlug?: string | null
}

export const shouldSendWishlistEmail = (
  preferences: AlertPrefsSlice | null | undefined
): boolean =>
  preferences?.wishlistAlertsEnabled === true &&
  preferences?.emailWishlistAlerts === true

export const shouldSendDecantEmail = (
  preferences: AlertPrefsSlice | null | undefined
): boolean =>
  preferences?.decantAlertsEnabled === true && preferences?.emailDecantAlerts === true

const logEmailDebug = (message: string): void => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[email] ${message}`)
  }
}

const buildAlertEmailBody = (params: {
  displayName: string
  message: string
  actionUrl: string
  preferencesUrl: string
}): string =>
  [
    `Hi ${params.displayName},`,
    "",
    params.message,
    "",
    params.actionUrl,
    "",
    `Manage alert preferences: ${params.preferencesUrl}`,
    "",
    "— Shadow and Sillage",
  ].join("\n")

export const sendWishlistAlertEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  perfumeName: string
  perfumeSlug: string
  message: string
}): Promise<void> => {
  if (!shouldSendWishlistEmail(params.preferences)) {
    logEmailDebug(
      `Skipped wishlist email for ${params.user.email}: wishlistAlerts=${params.preferences?.wishlistAlertsEnabled}, emailWishlist=${params.preferences?.emailWishlistAlerts}`
    )
    return
  }
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped wishlist email: invalid recipient ${params.user.email}`)
    return
  }

  const baseUrl = getAppBaseUrl()
  const displayName = getUserDisplayName(params.user)
  const perfumeUrl = `${baseUrl}${PERFUME_PATH}/${params.perfumeSlug}`
  const preferencesUrl = `${baseUrl}${getProfilePathForUser(params.user)}`

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: `${params.perfumeName} is now available on Shadow and Sillage`,
    text: buildAlertEmailBody({
      displayName,
      message: params.message,
      actionUrl: `View on the exchange: ${perfumeUrl}`,
      preferencesUrl,
    }),
  })

  if (result.sent) {
    logEmailDebug(`Sent wishlist email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(`Wishlist email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`)
  }
}

export const sendDecantInterestAlertEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  perfumeName: string
  perfumeSlug: string
  message: string
}): Promise<void> => {
  if (!shouldSendDecantEmail(params.preferences)) {
    logEmailDebug(
      `Skipped decant email for ${params.user.email}: decantAlerts=${params.preferences?.decantAlertsEnabled}, emailDecant=${params.preferences?.emailDecantAlerts}`
    )
    return
  }
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped decant email: invalid recipient ${params.user.email}`)
    return
  }

  const baseUrl = getAppBaseUrl()
  const displayName = getUserDisplayName(params.user)
  const perfumeUrl = `${baseUrl}${PERFUME_PATH}/${params.perfumeSlug}`
  const preferencesUrl = `${baseUrl}${getProfilePathForUser(params.user)}`

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: `Someone wants your ${params.perfumeName}!`,
    text: buildAlertEmailBody({
      displayName,
      message: params.message,
      actionUrl: `View listing: ${perfumeUrl}`,
      preferencesUrl,
    }),
  })

  if (result.sent) {
    logEmailDebug(`Sent decant email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(`Decant email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`)
  }
}
