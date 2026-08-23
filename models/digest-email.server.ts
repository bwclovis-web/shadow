import {
  getAppBaseUrl,
  isSendableRecipientEmail,
  sendTransactionalEmail,
} from "@/utils/email.server"
import { prisma } from "@/lib/db"
import { buildPersonalizedDigest } from "@/models/personalized-digest.server"
import { listRecentSavedSearchMatchesForDigest } from "@/models/saved-search.server"
import { getUserAlertPreferences } from "@/models/user-alerts.server"
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

const buildMatchTargetUrl = (payload: unknown, base: string) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return `${base}/the-exchange`
  }
  const obj = payload as Record<string, unknown>
  if (typeof obj.perfumeSlug === "string") {
    return `${base}/perfume/${obj.perfumeSlug}`
  }
  return `${base}/the-exchange`
}

/**
 * Email daily saved-search match summaries to Premium users on daily frequency.
 */
export const sendDailySavedSearchDigests = async (): Promise<{
  attempted: number
  sent: number
}> => {
  if (!isFeatureEnabled("savedSearches")) {
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
  const since = new Date()
  since.setDate(since.getDate() - 1)

  for (const user of users) {
    if (!isSendableRecipientEmail(user.email)) continue

    const preferences = await getUserAlertPreferences(user.id)
    if (
      preferences.savedSearchAlertsEnabled === false ||
      preferences.savedSearchAlertFrequency !== "daily"
    ) {
      continue
    }

    const matches = await listRecentSavedSearchMatchesForDigest(user.id, since)
    if (matches.length === 0) continue

    const matchLines = matches
      .map(
        m =>
          `- ${m.title}: ${m.message} — ${buildMatchTargetUrl(m.payload, base)}`
      )
      .join("\n")

    const text = [
      `Hi ${user.firstName || user.username},`,
      ``,
      `Your saved searches found ${matches.length} match${matches.length === 1 ? "" : "es"} in the last day:`,
      ``,
      matchLines,
      ``,
      `Open your digest: ${base}/digest`,
      `Manage saved searches: ${base}/community?tab=alerts`,
    ].join("\n")

    const html = `
      <p>Hi ${user.firstName || user.username},</p>
      <p>Your saved searches found <strong>${matches.length}</strong> match${matches.length === 1 ? "" : "es"} in the last day.</p>
      <ul>
        ${matches
          .map(
            m =>
              `<li><strong>${m.title}</strong> — ${m.message} <a href="${buildMatchTargetUrl(m.payload, base)}">View</a></li>`
          )
          .join("")}
      </ul>
      <p><a href="${base}/digest">Open your digest</a> · <a href="${base}/community?tab=alerts">Manage saved searches</a></p>
    `

    const result = await sendTransactionalEmail({
      to: user.email,
      subject: `Saved search matches — ${since.toISOString().slice(0, 10)}`,
      text,
      html,
    })
    if (result.sent) sent += 1
  }

  return { attempted: users.length, sent }
}
