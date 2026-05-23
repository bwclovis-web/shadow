/**
 * Smoke-test Resend from the CLI (uses .env).
 * Usage: npx tsx scripts/test-resend-email.ts your@email.com
 */
import "dotenv/config"

import { isValidEmailFrom, sendTransactionalEmail } from "../utils/email.server"

const main = async (): Promise<void> => {
  const to = process.argv[2]?.trim()
  if (!to) {
    console.error("Usage: npx tsx scripts/test-resend-email.ts recipient@example.com")
    process.exit(1)
  }

  const from = process.env.EMAIL_FROM
  console.log("EMAIL_FROM valid:", isValidEmailFrom(from))
  console.log("RESEND_API_KEY set:", Boolean(process.env.RESEND_API_KEY?.trim()))
  console.log("Sending test to:", to)

  try {
    const result = await sendTransactionalEmail({
      to,
      subject: "perfumer's hollow — Resend smoke test",
      text: "If you received this, Resend is configured correctly.",
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
