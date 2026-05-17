"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/Atoms/Button"
import type { ScentDnaSnapshot } from "@/models/scent-dna.server"
import { SEASON_KEYS } from "@/types/perfume-season-vote"
import { isScentDnaEmpty } from "@/utils/scent-dna/compute-scent-dna"
import type { NoteFamilyId } from "@/utils/scent-dna/note-families"

type ScentDnaCardProps = {
  scentDna: ScentDnaSnapshot
  traderName: string
  shareUrl?: string
  variant?: "compact" | "share"
}

const FAMILY_CHIP_CLASS =
  "rounded-full border border-noir-gold/40 bg-noir-black/60 px-2.5 py-0.5 text-xs font-medium text-noir-gold"

const HOUSE_PILL_CLASS =
  "rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-noir-gold-100"

const FAVORITE_NOTE_PILL_CLASS =
  "shrink-0 rounded-full border border-noir-gold/30 bg-noir-black/40 px-2 py-0.5 text-xs text-noir-gold-100"

const ScentDnaCard = ({
  scentDna,
  traderName,
  shareUrl,
  variant = "compact",
}: ScentDnaCardProps) => {
  const t = useTranslations("traderProfile.scentDna")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")

  const isEmpty = isScentDnaEmpty(scentDna)
  const isSharePage = variant === "share"

  const familyLabel = (family: NoteFamilyId) => t(`families.${family}`)

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    const url =
      shareUrl.startsWith("http") || typeof window === "undefined"
        ? shareUrl
        : `${window.location.origin}${shareUrl}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyState("copied")
      setTimeout(() => setCopyState("idle"), 2500)
    } catch {
      setCopyState("error")
      setTimeout(() => setCopyState("idle"), 4000)
    }
  }, [shareUrl])

  if (isEmpty) {
    return (
      <section
        className={`noir-border mx-auto max-w-md bg-noir-black/70 text-left ${
          isSharePage ? "p-6" : "mt-3 p-4"
        }`}
        aria-label={t("ariaLabel")}
      >
        <h2 className="text-base font-semibold text-noir-gold">{t("title")}</h2>
        <p className="mt-2 text-sm text-noir-gold-100">{t("empty")}</p>
        {!isSharePage ? (
          <p className="mt-3 text-sm">
            <Link href="/scent-quiz" className="text-noir-gold underline-offset-2 hover:underline">
              {t("takeQuiz")}
            </Link>
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className={`noir-border mx-auto max-w-md bg-noir-black/70 text-left ${
        isSharePage ? "p-6" : "mt-3 p-4"
      }`}
      aria-label={t("ariaLabel", { traderName })}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-noir-gold">{t("title")}</h2>
          <p className="text-xs text-noir-gold-500">{t("subtitle", { traderName })}</p>
        </div>
        {shareUrl ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2 shrink-0 sm:mt-0"
            onClick={() => void handleShare()}
          >
            {copyState === "copied"
              ? t("shareCopied")
              : copyState === "error"
                ? t("shareError")
                : t("shareCta")}
          </Button>
        ) : null}
      </div>

      {scentDna.hasNoteProfile ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-noir-gold-500">
            {t("noteFamiliesHeading")}
          </h3>
          <ul className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            {scentDna.topFamilies.map((entry) => (
              <li key={entry.family}>
                <span className={FAMILY_CHIP_CLASS}>
                  {familyLabel(entry.family)}
                  <span className="ml-1 text-noir-gold-500 tabular-nums">
                    {entry.percent}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scentDna.hasFavoriteNotes ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-noir-gold-500">
            {t("favoriteNotesHeading")}
          </h3>
          <ul
            className="mt-2 flex gap-2 overflow-x-auto pb-1 style-scroll-noir-cold"
            aria-label={t("favoriteNotesHeading")}
          >
            {scentDna.topNotes.map((note) => (
              <li key={note.noteId}>
                <span className={FAVORITE_NOTE_PILL_CLASS}>{note.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scentDna.hasSeasonVotes ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-noir-gold-500">
            {t("seasonHeading")}
          </h3>
          <ul className="mt-2 space-y-2">
            {SEASON_KEYS.map((season) => {
              const value = scentDna.seasonAffinity[season]
              return (
                <li key={season}>
                  <div className="flex items-center justify-between gap-2 text-xs text-noir-gold-100">
                    <span>{t(`season.${season}`)}</span>
                    <span className="tabular-nums text-noir-gold">{value}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-noir-gold/80"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {scentDna.houseBreakdown ? (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-noir-gold-500">
            {t("houseHeading")}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {(["indie", "niche", "designer"] as const).map((type) => (
              <li key={type}>
                <span className={HOUSE_PILL_CLASS}>
                  {t(`house.${type}`)}
                  <span className="ml-1 tabular-nums text-noir-gold">
                    {scentDna.houseBreakdown![type]}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export default ScentDnaCard
