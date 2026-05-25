/**
 * Smoke-test Resend from the CLI (uses .env).
 * Usage: npx tsx scripts/test-resend-email.ts your@email.com [wishlist|trade|security|dispute]
 */
import "dotenv/config"

import { buildEditorialAlertEmail } from "../utils/alert-email.server"
import {
  getAppBaseUrl,
  isValidEmailFrom,
  sendTransactionalEmail,
} from "../utils/email.server"

const buildPreviewEmail = (
  variant: "wishlist" | "trade" | "security" | "dispute"
): {
  subject: string
  text: string
  html: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: string
    contentType?: string
    contentId?: string
  }>
} => {
  const baseUrl = getAppBaseUrl()

  switch (variant) {
    case "trade":
      return {
        subject: "Jane accepted your exchange proposal",
        ...buildEditorialAlertEmail({
          variant: "trade",
          displayName: "Taylor",
          title: "Jane accepted your exchange proposal",
          lead: "There is new movement in your exchange for Noir Epices.",
          body: ["Open the conversation to keep the exchange moving."],
          ctaLabel: "View trade conversation",
          ctaUrl: `${baseUrl}/exchanges/jane-doe`,
          secondaryLabel: "Manage alert preferences",
          secondaryUrl: `${baseUrl}/taylor/profile`,
          spotlightLabel: "Regarding",
          spotlightValue: "Noir Epices",
        }),
      }
    case "security":
      return {
        subject: "Sign-in from a new device",
        ...buildEditorialAlertEmail({
          variant: "security",
          displayName: "Taylor",
          title: "Sign-in from a new device",
          lead: "Your account was signed in from a device we have not seen before.",
          body: ["Review your security settings if this activity was not yours."],
          ctaLabel: "Review security settings",
          ctaUrl: `${baseUrl}/taylor/profile/security`,
          secondaryLabel: "Manage alert preferences",
          secondaryUrl: `${baseUrl}/taylor/profile`,
        }),
      }
    case "dispute":
      return {
        subject: "Trade dispute resolution — perfumer's hollow",
        ...buildEditorialAlertEmail({
          variant: "dispute",
          displayName: "Taylor",
          title: "Your trade dispute has been resolved",
          lead: "Your trade dispute has been reviewed and resolved.",
          body: [
            "Outcome: Warning issued",
            "Trade reference: 8F31AB2C",
            "Summary: The moderation team reviewed both sides and closed the case.",
          ],
          ctaLabel: "View your disputes",
          ctaUrl: `${baseUrl}/taylor/profile/disputes`,
          secondaryLabel: "Review dispute policy",
          secondaryUrl: `${baseUrl}/community-policy#disputes`,
          spotlightLabel: "Trade reference",
          spotlightValue: "8F31AB2C",
        }),
      }
    case "wishlist":
    default:
      return {
        subject: "Noir Epices is now available on perfumer's hollow",
        ...buildEditorialAlertEmail({
          variant: "wishlist",
          displayName: "Taylor",
          title: "Noir Epices has surfaced in The Exchange",
          lead: "Noir Epices by Frederic Malle has surfaced in the Exchange from 2 collectors.",
          body: ["A bottle from your wishlist is moving through the Hollow right now."],
          ctaLabel: "View on the exchange",
          ctaUrl: `${baseUrl}/perfume/noir-epices`,
          secondaryLabel: "Manage alert preferences",
          secondaryUrl: `${baseUrl}/taylor/profile`,
          spotlightLabel: "Perfume",
          spotlightValue: "Noir Epices",
        }),
      }
  }
}

const main = async (): Promise<void> => {
  const to = process.argv[2]?.trim()
  const variant =
    (process.argv[3]?.trim().toLowerCase() as
      | "wishlist"
      | "trade"
      | "security"
      | "dispute"
      | undefined) ?? "wishlist"

  if (!to) {
    console.error(
      "Usage: npx tsx scripts/test-resend-email.ts recipient@example.com [wishlist|trade|security|dispute]"
    )
    process.exit(1)
  }

  const from = process.env.EMAIL_FROM
  const preview = buildPreviewEmail(variant)
  console.log("EMAIL_FROM valid:", isValidEmailFrom(from))
  console.log("RESEND_API_KEY set:", Boolean(process.env.RESEND_API_KEY?.trim()))
  console.log("Sending test to:", to)
  console.log("Preview variant:", variant)

  try {
    const result = await sendTransactionalEmail({
      to,
      subject: preview.subject,
      text: preview.text,
      html: preview.html,
      attachments: preview.attachments,
    })
    console.log("Result:", result)
    if (!result.sent) {
      console.error(
        "Email was not sent. Fix RESEND_API_KEY and EMAIL_FROM, then restart the dev server."
      )
      process.exit(1)
    }
  } catch (err) {
    console.error("Send failed:", err instanceof Error ? err.message : err)
    console.error(
      "\nTip: Until your domain is verified in Resend, you can usually only send to the email on your Resend account."
    )
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
