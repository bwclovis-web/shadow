import {
  getAppBaseUrl,
  isSendableRecipientEmail,
  sendTransactionalEmail,
} from "@/utils/email.server"
import { prisma } from "@/lib/db"
import { buildPersonalizedDigest } from "@/models/personalized-digest.server"
import { isFeatureEnabled } from "@/utils/feature-flags"

/**
 * Email weekly digests to Premium users with personalized_digests entitlement.
 */
export const sendWeeklyDigests = async (): Promise<{
  attempted: number
  sent: number
}> => {
  if (!isFeatureEnabled("personalizedDigests")) {
    return { attempted: 0, sent: 0 }
  }

  const users = await prisma.user.findMany({
    where: {
      membershipTier: { in: ["premium", "collector"] },
      isBanned: false,
    },
    select: { id: true, email: true, firstName: true, username: true },
    take: 500,
  })

  let sent = 0
  const base = getAppBaseUrl()

  for (const user of users) {
    if (!isSendableRecipientEmail(user.email)) continue
    const digest = await buildPersonalizedDigest(user.id)
    if (!digest) continue

    const recLines = digest.recommendations
      .map((r) => `- ${r.name}${r.reason ? ` (${r.reason})` : ""} — ${base}/perfume/${r.slug}`)
      .join("\n")

    const text = [
      `Hi ${user.firstName || user.username},`,
      ``,
      `Your weekly Hollow digest for week of ${digest.weekOf}:`,
      ``,
      digest.wardrobeHint,
      ``,
      `Suggested for you:`,
      recLines || "- (none this week)",
      ``,
      `Collection notes:`,
      ...digest.collectionGaps.map((g) => `- ${g}`),
      ``,
      `Open your digest anytime: ${base}/digest`,
      `Manage alerts: ${base}/community`,
    ].join("\n")

    const html = `
      <p>Hi ${user.firstName || user.username},</p>
      <p>Your weekly Hollow digest for <strong>${digest.weekOf}</strong>.</p>
      <p>${digest.wardrobeHint}</p>
      <h3>Suggested for you</h3>
      <ul>
        ${digest.recommendations
          .map(
            (r) =>
              `<li><a href="${base}/perfume/${r.slug}">${r.name}</a>${
                r.reason ? ` — ${r.reason}` : ""
              }</li>`
          )
          .join("")}
      </ul>
      <h3>Collection notes</h3>
      <ul>${digest.collectionGaps.map((g) => `<li>${g}</li>`).join("")}</ul>
      <p><a href="${base}/digest">Open your full digest</a> · <a href="${base}/community">Manage saved searches &amp; community</a></p>
    `

    const result = await sendTransactionalEmail({
      to: user.email,
      subject: `Your weekly scent digest — ${digest.weekOf}`,
      text,
      html,
    })
    if (result.sent) sent += 1
  }

  return { attempted: users.length, sent }
}
