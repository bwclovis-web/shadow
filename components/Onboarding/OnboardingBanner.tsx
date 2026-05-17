"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { FaCheck, FaChevronDown, FaChevronUp } from "react-icons/fa6"

import {
  completeOnboardingAction,
  dismissOnboardingAction,
  type OnboardingActionState,
} from "@/app/onboarding/actions"
import { Button } from "@/components/Atoms/Button"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import Modal from "@/components/Organisms/Modal"
import { useCSRF } from "@/hooks/useCSRF"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import type {
  OnboardingState,
  OnboardingStepId,
  OnboardingTraderMatch,
} from "@/models/onboarding.server"
import {
  getTradeCtaLabelKey,
  tradeListingSeedFromExchangeRow,
} from "@/types/trade"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const SCENT_QUIZ_ROUTE = "/scent-quiz?from=onboarding"
const MATCHES_VIEWED_API = "/api/onboarding/matches-viewed"

type OnboardingBannerProps = {
  state: OnboardingState
}

const STEP_ORDER: OnboardingStepId[] = ["quiz", "bottle", "matches"]

const OnboardingMatchesList = ({
  matches,
}: {
  matches: OnboardingTraderMatch[]
}) => {
  const t = useTranslations("onboarding.matches")
  const tTrade = useTranslations("tradeComposer")
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    closeComposer,
  } = useTradeComposerModal()

  const handleConnect = useCallback(
    (match: OnboardingTraderMatch, trigger: HTMLButtonElement | null) => {
      openComposer(
        {
          seed: tradeListingSeedFromExchangeRow(
            {
              id: match.userPerfumeId,
              userId: match.counterpartyId,
              available: match.available,
              type: null,
              tradePreference: match.tradePreference,
              tradeOnly: match.tradeOnly,
              price: match.price,
              tradePrice: match.tradePrice,
              images: match.images,
              condition: match.condition,
              decantFormat: match.decantFormat,
              mlRemaining: match.mlRemaining,
            },
            {
              perfumeId: match.perfumeId,
              perfumeName: match.perfumeName,
              perfumeHouse: match.perfumeHouse,
              perfumeImage: match.perfumeImage,
            }
          ),
          counterpartyDisplayName: match.counterpartyDisplayName,
        },
        trigger
      )
    },
    [openComposer]
  )

  if (matches.length === 0) {
    return (
      <p className="text-sm text-noir-gold-100/90 mt-3">{t("empty")}</p>
    )
  }

  return (
    <>
      <ul className="mt-3 flex flex-col gap-2">
        {matches.map(match => {
          const src = normalizeRemoteImageSrc(match.perfumeImage)
          const imageSrc =
            src && !validImageRegex.test(src) ? src : BOTTLE_PLACEHOLDER
          const ctaKey = getTradeCtaLabelKey(
            match.tradePreference,
            match.tradeOnly
          )
          return (
            <li
              key={match.userPerfumeId}
              className="flex flex-wrap items-center gap-3 rounded border border-noir-gold/30 bg-noir-black/40 p-3"
            >
              <Image
                src={imageSrc}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-noir-gold line-clamp-1">
                  {match.perfumeName}
                </p>
                <p className="text-xs text-noir-gold-100/80 line-clamp-1">
                  {match.counterpartyDisplayName}
                  {match.perfumeHouse ? ` · ${match.perfumeHouse}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={e =>
                  handleConnect(match, e.currentTarget as HTMLButtonElement)
                }
              >
                {tTrade(ctaKey)}
              </Button>
            </li>
          )
        })}
      </ul>
      {composerData && composerModalOpen ? (
        <Modal innerType="dark" animateStart="top">
          <TradeComposerModal data={composerData} onClose={closeComposer} />
        </Modal>
      ) : null}
    </>
  )
}

const OnboardingBanner = ({ state }: OnboardingBannerProps) => {
  const t = useTranslations("onboarding")
  const router = useRouter()
  const { csrfToken, isLoading: csrfLoading, addToHeaders } = useCSRF()
  const [expanded, setExpanded] = useState(false)
  const [matchesViewed, setMatchesViewed] = useState(state.steps.matches)
  const markingViewedRef = useRef(false)
  const [dismissState, dismissAction, dismissPending] = useActionState<
    OnboardingActionState,
    FormData
  >(dismissOnboardingAction, null)
  const [completeState, completeAction, completePending] = useActionState<
    OnboardingActionState,
    FormData
  >(completeOnboardingAction, null)

  const allStepsDone =
    state.steps.quiz && state.steps.bottle && (matchesViewed || state.steps.matches)

  useEffect(() => {
    if (dismissState?.success || completeState?.success) {
      router.refresh()
    }
  }, [dismissState, completeState, router])

  const markMatchesViewed = useCallback(async () => {
    if (markingViewedRef.current || matchesViewed || state.steps.matches) return
    const token = csrfToken
    if (!token) return
    markingViewedRef.current = true
    try {
      const res = await fetch(MATCHES_VIEWED_API, {
        method: "POST",
        credentials: "include",
        headers: addToHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ _csrf: token }),
      })
      if (res.ok) {
        setMatchesViewed(true)
      }
    } catch {
      markingViewedRef.current = false
    }
  }, [csrfToken, matchesViewed, state.steps.matches, addToHeaders])

  const handleToggleMatches = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      if (next) {
        void markMatchesViewed()
      }
      return next
    })
  }, [markMatchesViewed])

  const myScentsHref = `/${state.profileSlug}/profile/my-scents?onboarding=add-bottle`

  const stepLabels: Record<OnboardingStepId, string> = {
    quiz: t("steps.quiz"),
    bottle: t("steps.bottle"),
    matches: t("steps.matches"),
  }

  const stepHrefs: Record<OnboardingStepId, string | null> = {
    quiz: SCENT_QUIZ_ROUTE,
    bottle: myScentsHref,
    matches: null,
  }

  const stepsForDisplay: OnboardingState["steps"] = {
    quiz: state.steps.quiz,
    bottle: state.steps.bottle,
    matches: matchesViewed || state.steps.matches,
  }

  return (
    <div role="region" aria-label={t("bannerLabel")}>
      <div className="inner-container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-noir-gold tracking-wide">
              {t("title")}
            </p>
            <p className="text-xs text-noir-gold-100/85 mt-0.5">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allStepsDone ? (
              <form action={completeAction}>
                <CSRFToken />
                <Button
                  type="submit"
                  size="sm"
                  background="gold"
                  disabled={completePending || csrfLoading || !csrfToken}
                >
                  {t("done")}
                </Button>
              </form>
            ) : null}
            <form action={dismissAction}>
              <CSRFToken />
              <Button
                type="submit"
                variant="link"
                disabled={dismissPending || csrfLoading || !csrfToken}
                className="text-noir-gold-100/90 hover:text-noir-gold text-sm"
              >
                {t("skip")}
              </Button>
            </form>
          </div>
        </div>

        <ol className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
          {STEP_ORDER.map((stepId, index) => {
            const done = stepsForDisplay[stepId]
            const active = state.activeStep === stepId
            const href = stepHrefs[stepId]
            const stepContent = (
              <>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    done
                      ? "border-noir-gold bg-noir-gold text-noir-black"
                      : active
                        ? "border-noir-gold text-noir-gold"
                        : "border-noir-gold/40 text-noir-gold-100/60"
                  }`}
                  aria-hidden
                >
                  {done ? <FaCheck size={10} /> : index + 1}
                </span>
                <span className={active ? "text-noir-gold" : "text-noir-gold-100/80"}>
                  {stepLabels[stepId]}
                </span>
              </>
            )

            if (stepId === "matches") {
              return (
                <li key={stepId} className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    className="flex items-center gap-2 hover:text-noir-gold transition-colors"
                    onClick={handleToggleMatches}
                    disabled={!state.steps.quiz || !state.steps.bottle}
                  >
                    {stepContent}
                    {state.steps.quiz && state.steps.bottle ? (
                      expanded ? (
                        <FaChevronUp className="text-noir-gold-100/70" size={12} />
                      ) : (
                        <FaChevronDown className="text-noir-gold-100/70" size={12} />
                      )
                    ) : null}
                  </button>
                </li>
              )
            }

            return (
              <li key={stepId} className="flex items-center gap-2 text-sm">
                {href && !done ? (
                  <Link
                    href={href}
                    className="flex items-center gap-2 hover:text-noir-gold transition-colors"
                  >
                    {stepContent}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">{stepContent}</span>
                )}
              </li>
            )
          })}
        </ol>

        {expanded && state.steps.quiz && state.steps.bottle ? (
          <OnboardingMatchesList matches={state.matches} />
        ) : null}
      </div>
    </div>
  )
}

export default OnboardingBanner
