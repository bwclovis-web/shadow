import type { DisputeResolutionOutcome } from "@prisma/client"

import { PERFUME_PATH } from "@/constants/routes"
import type { AlertType, UserAlertPreferences } from "@/types/database"
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
  | "emailTradeAlerts"
  | "securityAlertsEnabled"
  | "emailSecurityAlerts"
>

const TRADE_EMAIL_ALERT_TYPES = [
  "trade_received",
  "trade_accepted",
  "trade_shipped",
  "trade_completed",
] as const satisfies readonly AlertType[]

const SPLIT_EMAIL_ALERT_TYPES = [
  "split_slot_claimed",
  "split_shipped",
  "split_completed",
  "split_cancelled",
] as const satisfies readonly AlertType[]

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

export const shouldSendTradeEmail = (
  preferences: AlertPrefsSlice | null | undefined
): boolean => preferences?.emailTradeAlerts === true

export const shouldSendSecurityEmail = (
  preferences: AlertPrefsSlice | null | undefined
): boolean =>
  preferences?.securityAlertsEnabled !== false &&
  preferences?.emailSecurityAlerts !== false

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
    "— perfumer's hollow",
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
    subject: `${params.perfumeName} is now available on perfumer's hollow`,
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

const buildTradeThreadUrl = (actorUserId: string): string =>
  `${getAppBaseUrl()}/messages/${actorUserId}`

export const sendSplitEventEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  alertType: AlertType
  title: string
  message: string
}): Promise<void> => {
  if (
    !SPLIT_EMAIL_ALERT_TYPES.includes(
      params.alertType as (typeof SPLIT_EMAIL_ALERT_TYPES)[number]
    )
  ) {
    return
  }
  if (!shouldSendDecantEmail(params.preferences)) {
    logEmailDebug(
      `Skipped split email for ${params.user.email}: decantAlerts=${params.preferences?.decantAlertsEnabled}, emailDecant=${params.preferences?.emailDecantAlerts}`
    )
    return
  }
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped split email: invalid recipient ${params.user.email}`)
    return
  }

  const displayName = getUserDisplayName(params.user)
  const preferencesUrl = `${getAppBaseUrl()}${getProfilePathForUser(params.user)}`
  const splitId =
    typeof (params as { splitId?: string }).splitId === "string"
      ? (params as { splitId?: string }).splitId
      : null
  const actionUrl = splitId
    ? `${getAppBaseUrl()}/splits/${splitId}`
    : `${getAppBaseUrl()}/the-exchange`

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: buildAlertEmailBody({
      displayName,
      message: `${params.title}\n\n${params.message}`,
      actionUrl: `View split: ${actionUrl}`,
      preferencesUrl,
    }),
  })

  if (result.sent) {
    logEmailDebug(`Sent split email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(`Split email not sent to ${params.user.email}`)
  }
}

export const sendTradeEventEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  alertType: AlertType
  title: string
  message: string
  actorUserId: string
}): Promise<void> => {
  if (!TRADE_EMAIL_ALERT_TYPES.includes(params.alertType as (typeof TRADE_EMAIL_ALERT_TYPES)[number])) {
    return
  }
  if (!shouldSendTradeEmail(params.preferences)) {
    logEmailDebug(
      `Skipped trade email for ${params.user.email}: emailTradeAlerts=${params.preferences?.emailTradeAlerts}`
    )
    return
  }
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped trade email: invalid recipient ${params.user.email}`)
    return
  }

  const displayName = getUserDisplayName(params.user)
  const threadUrl = buildTradeThreadUrl(params.actorUserId)
  const preferencesUrl = `${getAppBaseUrl()}${getProfilePathForUser(params.user)}`

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: buildAlertEmailBody({
      displayName,
      message: `${params.title}\n\n${params.message}`,
      actionUrl: `View trade conversation: ${threadUrl}`,
      preferencesUrl,
    }),
  })

  if (result.sent) {
    logEmailDebug(`Sent trade email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(`Trade email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`)
  }
}

const DISPUTE_OUTCOME_LABELS: Record<DisputeResolutionOutcome, string> = {
  noAction: "No further action",
  warningIssued: "Warning issued",
  strikeIssued: "Strike issued",
  tradeVoided: "Trade voided by admin",
}

export const sendDisputeResolutionEmail = async (params: {
  user: RecipientUser
  disputeId: string
  tradeId: string
  outcome: DisputeResolutionOutcome
  publicSummary: string | null
}): Promise<void> => {
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped dispute resolution email: invalid recipient ${params.user.email}`)
    return
  }

  const baseUrl = getAppBaseUrl()
  const displayName = getUserDisplayName(params.user)
  const policyUrl = `${baseUrl}/community-policy#disputes`
  const disputesUrl = `${baseUrl}${getProfilePathForUser(params.user)}/disputes`
  const outcomeLabel = DISPUTE_OUTCOME_LABELS[params.outcome]
  const summaryBlock = params.publicSummary
    ? `\n\nSummary: ${params.publicSummary}`
    : ""

  const message = [
    "Your trade dispute has been reviewed and resolved.",
    "",
    `Outcome: ${outcomeLabel}`,
    `Trade reference: ${params.tradeId.slice(-8)}`,
    summaryBlock,
    "",
    "Community policy: " + policyUrl,
  ]
    .filter(Boolean)
    .join("\n")

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: "Trade dispute resolution — perfumer's hollow",
    text: buildAlertEmailBody({
      displayName,
      message,
      actionUrl: `View your disputes: ${disputesUrl}`,
      preferencesUrl: `${baseUrl}${getProfilePathForUser(params.user)}`,
    }),
  })

  if (result.sent) {
    logEmailDebug(
      `Sent dispute resolution email to ${params.user.email} (dispute ${params.disputeId})`
    )
  } else {
    logEmailDebug(
      `Dispute resolution email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`
    )
  }
}

export const sendSecurityAlertEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  title: string
  message: string
}): Promise<void> => {
  if (!shouldSendSecurityEmail(params.preferences)) {
    logEmailDebug(
      `Skipped security email for ${params.user.email}: securityAlerts=${params.preferences?.securityAlertsEnabled}, emailSecurity=${params.preferences?.emailSecurityAlerts}`
    )
    return
  }
  if (!isSendableRecipientEmail(params.user.email)) {
    logEmailDebug(`Skipped security email: invalid recipient ${params.user.email}`)
    return
  }

  const baseUrl = getAppBaseUrl()
  const displayName = getUserDisplayName(params.user)
  const securityUrl = `${baseUrl}${getProfilePathForUser(params.user)}/security`
  const preferencesUrl = `${baseUrl}${getProfilePathForUser(params.user)}`

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: buildAlertEmailBody({
      displayName,
      message: params.message,
      actionUrl: `Review security settings: ${securityUrl}`,
      preferencesUrl,
    }),
  })

  if (result.sent) {
    logEmailDebug(`Sent security email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(
      `Security email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`
    )
  }
}
