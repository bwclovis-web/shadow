"use client"

import { ExchangeEmptyIllustration } from "@/components/Atoms/ExchangeEmptyIllustration"
import { Button, VooDooLink } from "@/components/Atoms/Button"
import { JoinLink } from "@/components/Molecules/JoinLink"
import { styleMerge } from "@/utils/styleUtils"

export type ExchangeResultsStatePanelProps = {
  mode: "zero-matches" | "no-inventory" | "failure" | "stale"
  title: string
  description: string
  /** Shown for stale while previous cards are still visible. */
  staleLabel?: string
  clearLabel?: string
  onClearFilters?: () => void
  showClearFilters?: boolean
  retryLabel?: string
  onRetry?: () => void
  browseArchiveHref?: string
  browseArchiveLabel?: string
  collectorsGuideHref?: string
  collectorsGuideLabel?: string
  signInHref?: string
  signInLabel?: string
  showJoinLink?: boolean
  className?: string
  /** When true, omit the illustration (e.g. compact stale banner above cards). */
  hideIllustration?: boolean
}

export const ExchangeResultsStatePanel = ({
  mode,
  title,
  description,
  staleLabel,
  clearLabel,
  onClearFilters,
  showClearFilters = false,
  retryLabel,
  onRetry,
  browseArchiveHref,
  browseArchiveLabel,
  collectorsGuideHref,
  collectorsGuideLabel,
  signInHref,
  signInLabel,
  showJoinLink = false,
  className,
  hideIllustration = false,
}: ExchangeResultsStatePanelProps) => {
  const isFailure = mode === "failure"
  const isStale = mode === "stale"

  return (
    <div
      role={isFailure ? "alert" : "status"}
      aria-live={isStale || isFailure ? "polite" : undefined}
      className={styleMerge(
        "animate-fade-in space-y-4 rounded-md border-2 py-8 text-center",
        isFailure
          ? "border-noir-gold/80 bg-noir-dark/90"
          : isStale
            ? "border-noir-gold/40 bg-noir-black/50 px-4 py-4"
            : "border-noir-gold bg-noir-dark/80 px-4",
        className
      )}
    >
      {!hideIllustration && !isStale ? <ExchangeEmptyIllustration /> : null}

      {isStale && staleLabel ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-noir-gold">
          {staleLabel}
        </p>
      ) : null}

      <h2 className="!text-2xl md:!text-3xl">{title}</h2>
      <p className="mx-auto max-w-lg text-noir-gold-100">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {showClearFilters && onClearFilters && clearLabel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onClearFilters}
          >
            {clearLabel}
          </Button>
        ) : null}
        {isFailure && onRetry && retryLabel ? (
          <Button type="button" variant="primary" background="gold" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {mode === "no-inventory" && browseArchiveHref && browseArchiveLabel ? (
          <VooDooLink
            url={browseArchiveHref}
            variant="primary"
            background="gold"
          >
            {browseArchiveLabel}
          </VooDooLink>
        ) : null}
        {mode === "no-inventory" &&
        collectorsGuideHref &&
        collectorsGuideLabel ? (
          <VooDooLink url={collectorsGuideHref} variant="secondary">
            {collectorsGuideLabel}
          </VooDooLink>
        ) : null}
        {mode === "no-inventory" && signInHref && signInLabel ? (
          <VooDooLink url={signInHref} variant="secondary">
            {signInLabel}
          </VooDooLink>
        ) : null}
        {mode === "no-inventory" && showJoinLink ? (
          <JoinLink placement="exchange-empty" />
        ) : null}
      </div>
    </div>
  )
}
