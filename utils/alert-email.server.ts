import type { DisputeResolutionOutcome } from "@prisma/client"
import fs from "fs"
import path from "path"

import { PERFUME_PATH } from "@/constants/routes"
import type { AlertType, UserAlertPreferences } from "@/types/database"
import { renderEditorialEmailTemplate } from "@/utils/email-templates.server"
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

type EditorialAlertVariant =
  | "wishlist"
  | "decant"
  | "trade"
  | "split"
  | "security"
  | "dispute"

type EditorialAlertEmailInput = {
  variant: EditorialAlertVariant
  displayName: string
  title: string
  preheader?: string
  lead: string
  body?: string[]
  ctaLabel: string
  ctaUrl: string
  secondaryLabel?: string
  secondaryUrl?: string
  spotlightLabel?: string
  spotlightValue?: string
}

type BuiltEditorialAlertEmail = {
  text: string
  html: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: string
    contentType?: string
    contentId?: string
  }>
}

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

const EDITORIAL_ALERT_COPY: Record<
  EditorialAlertVariant,
  {
    templateVariant: "exchange" | "correspondence" | "security" | "resolution"
    dispatchLabel: string
    eyebrow: string
    footerTagline: string
    footerDetails: string[]
  }
> = {
  wishlist: {
    templateVariant: "exchange",
    dispatchLabel: "From The Exchange",
    eyebrow: "Wishlist alert",
    footerTagline: "Rare fragrances find new homes here.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "You can manage alert preferences from your profile whenever you like.",
    ],
  },
  decant: {
    templateVariant: "exchange",
    dispatchLabel: "From The Exchange",
    eyebrow: "Collector interest",
    footerTagline: "Every exchange begins with discovery.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "You can manage alert preferences from your profile whenever you like.",
    ],
  },
  trade: {
    templateVariant: "correspondence",
    dispatchLabel: "Notes From The Exchange",
    eyebrow: "Trade correspondence",
    footerTagline: "Every exchange begins with discovery.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "You can manage alert preferences from your profile whenever you like.",
    ],
  },
  split: {
    templateVariant: "correspondence",
    dispatchLabel: "Notes From The Exchange",
    eyebrow: "Split dispatch",
    footerTagline: "Collectors keep the Hollow moving one pour at a time.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "You can manage alert preferences from your profile whenever you like.",
    ],
  },
  security: {
    templateVariant: "security",
    dispatchLabel: "Security Notice From The Hollow",
    eyebrow: "Account security",
    footerTagline: "What happens in the shadows should stay yours.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "Security alerts are enabled by default to help protect your account.",
    ],
  },
  dispute: {
    templateVariant: "resolution",
    dispatchLabel: "Resolution From The Exchange",
    eyebrow: "Dispute resolution",
    footerTagline: "Transparent exchanges keep the Hollow healthy.",
    footerDetails: [
      "This message was sent to the email address on your perfumer's hollow account.",
      "perfumer's hollow connects collectors and moderates disputes, but never processes payments or shipping.",
    ],
  },
}

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

const normalizeParagraphs = (...values: Array<string | null | undefined>): string[] =>
  values
    .flatMap(value => (value ?? "").split(/\n+/))
    .map(value => value.trim())
    .filter(Boolean)

const extractRegardingValue = (message: string): string | null => {
  const prefix = "Regarding "
  return message.startsWith(prefix) ? message.slice(prefix.length).trim() : null
}

let inlineLogoContentBase64: string | null = null

const getInlineLogoContentBase64 = (): string => {
  if (inlineLogoContentBase64) return inlineLogoContentBase64

  const logoPath = path.join(process.cwd(), "public", "images", "new", "logo-one-email.png")
  inlineLogoContentBase64 = fs.readFileSync(logoPath).toString("base64")
  return inlineLogoContentBase64
}

const getInlineLogoAttachment = (): NonNullable<BuiltEditorialAlertEmail["attachments"]>[number] => ({
  filename: "logo-one-email.png",
  content: getInlineLogoContentBase64(),
  contentType: "image/png",
  contentId: "ph-logo",
})

export const buildEditorialAlertEmail = (
  params: EditorialAlertEmailInput
): BuiltEditorialAlertEmail => {
  const copy = EDITORIAL_ALERT_COPY[params.variant]
  const bodyParagraphs = normalizeParagraphs(...(params.body ?? []))

  const textLines = [
    `Hi ${params.displayName},`,
    "",
    params.title,
    "",
    params.lead,
    "",
    ...bodyParagraphs.flatMap(paragraph => [paragraph, ""]),
    `${params.ctaLabel}: ${params.ctaUrl}`,
    ...(params.secondaryLabel && params.secondaryUrl
      ? ["", `${params.secondaryLabel}: ${params.secondaryUrl}`]
      : []),
    "",
    copy.footerTagline,
    ...copy.footerDetails,
    "",
    "— perfumer's hollow",
  ]

  return {
    text: textLines.join("\n"),
    html: renderEditorialEmailTemplate({
      variant: copy.templateVariant,
      logoSrc: "cid:ph-logo",
      preheader: params.preheader ?? params.title,
      dispatchLabel: copy.dispatchLabel,
      eyebrow: copy.eyebrow,
      title: params.title,
      greeting: `Hi ${params.displayName},`,
      lead: params.lead,
      body: bodyParagraphs,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
      secondaryLabel: params.secondaryLabel,
      secondaryUrl: params.secondaryUrl,
      spotlightLabel: params.spotlightLabel,
      spotlightValue: params.spotlightValue,
      footerTagline: copy.footerTagline,
      footerDetails: copy.footerDetails,
    }),
    attachments: [getInlineLogoAttachment()],
  }
}

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
  const subject = `${params.perfumeName} is now available on perfumer's hollow`
  const email = buildEditorialAlertEmail({
    variant: "wishlist",
    displayName,
    title: `${params.perfumeName} has surfaced in The Exchange`,
    preheader: subject,
    lead: params.message,
    body: ["A bottle from your wishlist is moving through the Hollow right now."],
    ctaLabel: "View on the exchange",
    ctaUrl: perfumeUrl,
    secondaryLabel: "Manage alert preferences",
    secondaryUrl: preferencesUrl,
    spotlightLabel: "Perfume",
    spotlightValue: params.perfumeName,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
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
  const subject = `Someone wants your ${params.perfumeName}!`
  const email = buildEditorialAlertEmail({
    variant: "decant",
    displayName,
    title: `Interest stirred around ${params.perfumeName}`,
    preheader: subject,
    lead: params.message,
    body: ["A collector nearby the Hollow is looking for this bottle right now."],
    ctaLabel: "View listing",
    ctaUrl: perfumeUrl,
    secondaryLabel: "Manage alert preferences",
    secondaryUrl: preferencesUrl,
    spotlightLabel: "Perfume",
    spotlightValue: params.perfumeName,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
  })

  if (result.sent) {
    logEmailDebug(`Sent decant email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(`Decant email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`)
  }
}

const buildTradeThreadUrl = (actorUserId: string): string =>
  `${getAppBaseUrl()}/exchanges/${actorUserId}`

export const sendSplitEventEmail = async (params: {
  user: RecipientUser
  preferences: AlertPrefsSlice | null | undefined
  alertType: AlertType
  title: string
  message: string
  splitId?: string
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
  const actionUrl = params.splitId
    ? `${getAppBaseUrl()}/splits/${params.splitId}`
    : `${getAppBaseUrl()}/the-exchange`
  const email = buildEditorialAlertEmail({
    variant: "split",
    displayName,
    title: params.title,
    preheader: params.title,
    lead: params.message,
    body: ["Review the split to keep every pour, claim, and shipment on track."],
    ctaLabel: "View split",
    ctaUrl: actionUrl,
    secondaryLabel: "Manage alert preferences",
    secondaryUrl: preferencesUrl,
    spotlightLabel: params.splitId ? "Split reference" : undefined,
    spotlightValue: params.splitId ? params.splitId.slice(-8).toUpperCase() : undefined,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
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
  const perfumeReference = extractRegardingValue(params.message)
  const lead = perfumeReference
    ? `There is new movement in your exchange for ${perfumeReference}.`
    : params.message
  const email = buildEditorialAlertEmail({
    variant: "trade",
    displayName,
    title: params.title,
    preheader: params.title,
    lead,
    body: ["Open the conversation to keep the exchange moving."],
    ctaLabel: "View trade conversation",
    ctaUrl: threadUrl,
    secondaryLabel: "Manage alert preferences",
    secondaryUrl: preferencesUrl,
    spotlightLabel: perfumeReference ? "Regarding" : undefined,
    spotlightValue: perfumeReference ?? undefined,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
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
  const tradeReference = params.tradeId.slice(-8).toUpperCase()
  const email = buildEditorialAlertEmail({
    variant: "dispute",
    displayName,
    title: "Your trade dispute has been resolved",
    preheader: "Trade dispute resolution — perfumer's hollow",
    lead: "Your trade dispute has been reviewed and resolved.",
    body: [
      `Outcome: ${outcomeLabel}`,
      `Trade reference: ${tradeReference}`,
      ...(params.publicSummary ? [`Summary: ${params.publicSummary}`] : []),
    ],
    ctaLabel: "View your disputes",
    ctaUrl: disputesUrl,
    secondaryLabel: "Review dispute policy",
    secondaryUrl: policyUrl,
    spotlightLabel: "Trade reference",
    spotlightValue: tradeReference,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: "Trade dispute resolution — perfumer's hollow",
    text: email.text,
    html: email.html,
    attachments: email.attachments,
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
  const email = buildEditorialAlertEmail({
    variant: "security",
    displayName,
    title: params.title,
    preheader: params.title,
    lead: params.message,
    body: ["Review your security settings if this activity was not yours."],
    ctaLabel: "Review security settings",
    ctaUrl: securityUrl,
    secondaryLabel: "Manage alert preferences",
    secondaryUrl: preferencesUrl,
  })

  const result = await sendTransactionalEmail({
    to: params.user.email,
    subject: params.title,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
  })

  if (result.sent) {
    logEmailDebug(`Sent security email to ${params.user.email} (id: ${result.id ?? "unknown"})`)
  } else {
    logEmailDebug(
      `Security email not sent to ${params.user.email} (check RESEND_API_KEY / EMAIL_FROM)`
    )
  }
}
