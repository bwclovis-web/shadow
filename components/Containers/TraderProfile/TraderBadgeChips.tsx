"use client"

import { useTranslations } from "next-intl"

import type { ContributorBadgeIdPhase1 } from "@/services/reputation/contributor/types"
import type { ReputationBadgeId } from "@/services/reputation/types"

const REPUTATION_BADGE_ORDER: ReputationBadgeId[] = [
  "reliableTrader",
  "topReviewed",
  "fastResponder",
]

const CONTRIBUTOR_BADGE_ORDER: ContributorBadgeIdPhase1[] = [
  "trustedSwapper",
  "communityPillar",
  "rareCollector",
  "helpfulReviewer",
]

type DisplayBadge =
  | { kind: "reputation"; id: ReputationBadgeId }
  | { kind: "contributor"; id: ContributorBadgeIdPhase1 }

const sortReputationBadges = (ids: ReputationBadgeId[]): ReputationBadgeId[] => {
  const set = new Set(ids)
  return REPUTATION_BADGE_ORDER.filter((id) => set.has(id))
}

const sortContributorBadges = (
  ids: ContributorBadgeIdPhase1[]
): ContributorBadgeIdPhase1[] => {
  const set = new Set(ids)
  return CONTRIBUTOR_BADGE_ORDER.filter((id) => set.has(id))
}

const mergeDisplayBadges = (
  reputationBadges: ReputationBadgeId[],
  contributorBadges: ContributorBadgeIdPhase1[]
): DisplayBadge[] => [
  ...sortReputationBadges(reputationBadges).map(
    (id): DisplayBadge => ({ kind: "reputation", id })
  ),
  ...sortContributorBadges(contributorBadges).map(
    (id): DisplayBadge => ({ kind: "contributor", id })
  ),
]

type TraderBadgeChipsProps = {
  reputationBadges?: ReputationBadgeId[]
  contributorBadges?: ContributorBadgeIdPhase1[]
  className?: string
}

const TraderBadgeChips = ({
  reputationBadges = [],
  contributorBadges = [],
  className = "",
}: TraderBadgeChipsProps) => {
  const tRep = useTranslations("traderProfile.reputation")
  const tContrib = useTranslations("traderProfile.contributorBadges")

  const badges = mergeDisplayBadges(reputationBadges, contributorBadges)
  if (badges.length === 0) return null

  const labelFor = (badge: DisplayBadge): string =>
    badge.kind === "reputation"
      ? tRep(`badges.${badge.id}`)
      : tContrib(badge.id)

  return (
    <ul
      className={`flex flex-wrap justify-center gap-2 ${className}`.trim()}
      aria-label={tRep("badgesAria")}
    >
      {badges.map((badge) => (
        <li key={`${badge.kind}-${badge.id}`}>
          <span className="inline-flex items-center rounded-full border border-noir-gold/50 bg-noir-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-noir-gold">
            {labelFor(badge)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default TraderBadgeChips
