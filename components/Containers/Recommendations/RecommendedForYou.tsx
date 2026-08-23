"use client"

import Image from "next/image"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import type { RecommendationPerfume } from "@/services/recommendations"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"
import { perfumeImageTransitionName } from "@/utils/view-transition-names"

import { RecommendationReasonLine } from "./RecommendationReasonLine"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const PERFUME_LIMIT = 6

interface RecommendedForYouProps {
  perfumes: RecommendationPerfume[]
  limit?: number
  /** When set, show feedback actions (requires session CSRF cookie). */
  enableFeedback?: boolean
}

const feedbackActions = [
  { action: "not_for_me", label: "Not for me" },
  { action: "already_own", label: "Already own" },
  { action: "sampled", label: "Sampled" },
  { action: "more_like_this", label: "More like this" },
] as const

const RecommendedForYou = ({
  perfumes,
  limit = PERFUME_LIMIT,
  enableFeedback = true,
}: RecommendedForYouProps) => {
  const tRecommendations = useTranslations("recommendations")
  const tSingleHouse = useTranslations("singleHouse")
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const list = (perfumes ?? [])
    .filter(p => !hiddenIds.has(p.id))
    .slice(0, limit)

  const sharedListReason = useMemo(() => {
    const first = list[0]?.reason
    if (!first || (first.kind !== "popular" && first.kind !== "recent")) return null
    if (!list.every(p => p.reason?.kind === first.kind)) return null
    return first
  }, [list])

  const sendFeedback = async (
    perfumeId: string,
    action: (typeof feedbackActions)[number]["action"]
  ) => {
    setPendingId(perfumeId)
    try {
      const csrf =
        document.cookie
          .split("; ")
          .find(c => c.startsWith("_csrf="))
          ?.split("=")[1] ?? ""
      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify({
          perfumeId,
          action,
          source: "recommended_for_you",
          ...(csrf ? { _csrf: decodeURIComponent(csrf) } : {}),
        }),
      })
      if (res.ok && action !== "more_like_this") {
        setHiddenIds(prev => new Set(prev).add(perfumeId))
      }
    } finally {
      setPendingId(null)
    }
  }

  if (list.length === 0) return null

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-center mb-4 text-noir-gold-500">
        {tRecommendations("recommendedForYou")}
      </h2>
      {sharedListReason && (
        <div className="flex justify-center mb-4">
          <RecommendationReasonLine
            reason={sharedListReason}
            panelClassName="max-w-2xl text-center"
          />
        </div>
      )}
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
        {list.map((similar, index) => {
          const recSrc = normalizeRemoteImageSrc(similar.image)
          const recImageSrc =
            recSrc && !validImageRegex.test(recSrc) ? recSrc : BOTTLE_PLACEHOLDER
          return (
            <li
              key={similar.id}
              className="h-full noir-border relative w-full transition-colors duration-300 ease-in-out hover:bg-white/5 flex flex-col"
            >
              <PrefetchLink
                href={`/perfume/${similar.slug}`}
                prefetch={false}
                className="block p-2 flex-1 min-h-0"
              >
                <h3 className="text-center block text-sm tracking-wide py-2 font-semibold text-noir-gold leading-tight capitalize line-clamp-2">
                  {similar.name}
                </h3>
                <Image
                  src={recImageSrc}
                  alt={tSingleHouse("perfumeBottleAltText", { name: similar.name })}
                  priority={index < 3}
                  width={128}
                  height={128}
                  quality={75}
                  className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  style={
                    {
                      viewTransitionName: perfumeImageTransitionName(similar.id),
                    } as React.CSSProperties
                  }
                />
                {similar.perfumeHouse && (
                  <p className="text-center text-xs text-noir-gold-500/80 truncate">
                    {similar.perfumeHouse.name}
                  </p>
                )}
              </PrefetchLink>
              {!sharedListReason && similar.reason != null && (
                <div className="flex justify-center pb-2 px-2">
                  <RecommendationReasonLine reason={similar.reason} />
                </div>
              )}
              {enableFeedback && (
                <div className="flex flex-wrap justify-center gap-1 px-2 pb-3">
                  {feedbackActions.map(fa => (
                    <button
                      key={fa.action}
                      type="button"
                      disabled={pendingId === similar.id}
                      onClick={() => void sendFeedback(similar.id, fa.action)}
                      className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-noir-gold/30 text-noir-gold-500 hover:bg-white/5 disabled:opacity-50"
                    >
                      {fa.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default RecommendedForYou
