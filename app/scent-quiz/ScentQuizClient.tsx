"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import { SeasonSelectionToggleRow } from "@/components/Containers/Perfume/PerfumeSeasonVote"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { Tag } from "@/lib/queries/tags"
import { SEASON_KEYS, type SeasonSelection } from "@/types/perfume-season-vote"

import {
  submitScentQuizAction,
  type ScentQuizActionState,
} from "./actions"
import {
  MAX_NOTE_SELECTIONS,
  MIN_NOTE_SELECTIONS,
  Q,
  SCENT_QUIZ_ROUTE,
  type StepId,
} from "./constants"

const BANNER_IMAGE = "/images/quiz.png"

type BrowsingId = "explorer" | "focused" | "trader"

const BROWSING_OPTIONS: { value: BrowsingId; labelKey: "explorer" | "focused" | "trader" }[] = [
  { value: "explorer", labelKey: "explorer" },
  { value: "focused", labelKey: "focused" },
  { value: "trader", labelKey: "trader" },
]

export type ScentQuizClientProps = {
  notes: readonly { id: string; name: string }[]
  step: StepId
  initialNoteIds: string[]
  initialAvoidNoteIds: string[]
  initialSeasonIds: string[]
  initialBrowsingStyle: string
}

export default function ScentQuizClient({
  notes,
  step,
  initialNoteIds,
  initialAvoidNoteIds,
  initialSeasonIds,
  initialBrowsingStyle,
}: ScentQuizClientProps) {
  const t = useTranslations("quiz")
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<
    ScentQuizActionState,
    FormData
  >(submitScentQuizAction, null)

  const [selectedNoteIds, setSelectedNoteIds] = useState(() => new Set(initialNoteIds))
  const [avoidNoteIds, setAvoidNoteIds] = useState(() => new Set(initialAvoidNoteIds))
  const [selectedSeasonIds, setSelectedSeasonIds] = useState(
    () => new Set(initialSeasonIds)
  )
  const [browsingStyle, setBrowsingStyle] = useState<BrowsingId | "">(
    () => (initialBrowsingStyle as BrowsingId | "") || ""
  )

  const urlQuizStateKey = useMemo(
    () =>
      [
        initialNoteIds.join(","),
        initialAvoidNoteIds.join(","),
        initialSeasonIds.join(","),
        initialBrowsingStyle,
      ].join("|"),
    [initialNoteIds, initialAvoidNoteIds, initialSeasonIds, initialBrowsingStyle]
  )

  /* Sync when URL-derived snapshot changes; urlQuizStateKey avoids redundant runs on RSC array identity */
  useEffect(() => {
    setSelectedNoteIds(new Set(initialNoteIds))
    setAvoidNoteIds(new Set(initialAvoidNoteIds))
    setSelectedSeasonIds(new Set(initialSeasonIds))
    setBrowsingStyle((initialBrowsingStyle as BrowsingId | "") || "")
  }, [urlQuizStateKey]) // eslint-disable-line react-hooks/exhaustive-deps -- initial* align with urlQuizStateKey

  const stepParams = useMemo(
    () => ({
      noteIds: [...selectedNoteIds],
      avoidIds: [...avoidNoteIds],
      seasonIds: [...selectedSeasonIds],
      browsingStyle,
    }),
    [selectedNoteIds, avoidNoteIds, selectedSeasonIds, browsingStyle]
  )

  const buildStepUrl = useCallback(
    (target: StepId) => {
      const sp = new URLSearchParams()
      sp.set(Q.step, target)
      if (stepParams.noteIds.length) sp.set(Q.noteIds, stepParams.noteIds.join(","))
      if (stepParams.avoidIds.length) sp.set(Q.avoidNoteIds, stepParams.avoidIds.join(","))
      if (stepParams.seasonIds.length) sp.set(Q.season, stepParams.seasonIds.join(","))
      if (stepParams.browsingStyle) sp.set(Q.browsingStyle, stepParams.browsingStyle)
      return `${SCENT_QUIZ_ROUTE}?${sp.toString()}`
    },
    [stepParams]
  )

  const noteNameById = useMemo(
    () => new Map(notes.map((n) => [n.id, n.name])),
    [notes]
  )

  const likedTagsData = useMemo((): Tag[] => {
    return [...selectedNoteIds].map((id) => ({
      id,
      name: noteNameById.get(id) ?? id,
    }))
  }, [selectedNoteIds, noteNameById])

  const avoidTagsData = useMemo((): Tag[] => {
    return [...avoidNoteIds].map((id) => ({
      id,
      name: noteNameById.get(id) ?? id,
    }))
  }, [avoidNoteIds, noteNameById])

  const setLikedTags = useCallback((tags: Tag[]) => {
    setSelectedNoteIds(new Set(tags.map((t) => t.id)))
  }, [])

  const setAvoidTags = useCallback((tags: Tag[]) => {
    setAvoidNoteIds(new Set(tags.map((t) => t.id)))
  }, [])

  const seasonSelection = useMemo(
    (): SeasonSelection => ({
      winter: selectedSeasonIds.has("winter"),
      spring: selectedSeasonIds.has("spring"),
      summer: selectedSeasonIds.has("summer"),
      fall: selectedSeasonIds.has("fall"),
    }),
    [selectedSeasonIds]
  )

  const setSeasonSelection = useCallback((next: SeasonSelection) => {
    setSelectedSeasonIds(new Set(SEASON_KEYS.filter((k) => next[k])))
  }, [])

  useEffect(() => {
    if (state?.success) {
      router.refresh()
    }
  }, [state?.success, router])

  if (state?.success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("success.heading")}
        />
        <p className="mt-6 text-lg text-noir-gold-500">{t("success.subheading")}</p>
        <Button variant="primary" className="mt-8" background="gold" size="xl">
          <Link href="/">{t("success.cta")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("banner.heading")}
        subheading={t("banner.subheading")}
      />

      <div className="inner-container mx-auto pb-8">
        {step === "welcome" && (
          <div className="mt-8 space-y-6">
            <p className="text-noir-gold-100 text-lg">{t("welcome.body")}</p>
            <div className="flex flex-wrap gap-4">
              <VooDooLink url={buildStepUrl("note-preferences")} variant="primary">
                {t("welcome.start")}
              </VooDooLink>
              <VooDooLink url="/" variant="secondary">
                {t("welcome.skip")}
              </VooDooLink>
            </div>
          </div>
        )}

        {step === "note-preferences" && (
          <div className="mt-8">
            <p className="mb-4 text-noir-gold-500">
              {t("notes.prompt", { min: MIN_NOTE_SELECTIONS, max: MAX_NOTE_SELECTIONS })}
            </p>
            <div className="rounded border border-noir-gold bg-stone-800/50 p-4">
              <TagSearch
                allowCreate={false}
                data={likedTagsData}
                onChange={setLikedTags}
                label={t("notes.likedLabel")}
                searchInputLabel={t("notes.searchLabel")}
                inputId="scent-quiz-liked-notes"
                maxSelections={MAX_NOTE_SELECTIONS}
                selectedLayout="flow"
                surface="dark"
              />
            </div>
            {selectedNoteIds.size >= MAX_NOTE_SELECTIONS && (
              <p className="mt-2 text-sm text-amber-400/90">
                {t("notes.maxReached", { max: MAX_NOTE_SELECTIONS })}
              </p>
            )}
            <p className="mt-2 text-sm text-noir-gold-100">
              {t("notes.selected", { count: selectedNoteIds.size, max: MAX_NOTE_SELECTIONS })}
            </p>
            <div className="mt-6 flex gap-4">
              <VooDooLink url={buildStepUrl("welcome")} variant="secondary">
                {t("nav.back")}
              </VooDooLink>
              <VooDooLink
                variant="primary"
                url={buildStepUrl("avoid-notes")}
                aria-disabled={selectedNoteIds.size < MIN_NOTE_SELECTIONS}
              >
                {t("nav.next")}
              </VooDooLink>
            </div>
          </div>
        )}

        {step === "avoid-notes" && (
          <div className="mt-8">
            <p className="mb-4 text-stone-300">{t("avoid.prompt")}</p>
            <div className="rounded border border-stone-600 bg-stone-800/50 p-4">
              <TagSearch
                allowCreate={false}
                data={avoidTagsData}
                onChange={setAvoidTags}
                label={t("avoid.fieldLabel")}
                searchInputLabel={t("avoid.searchLabel")}
                inputId="scent-quiz-avoid-notes"
                selectedLayout="flow"
                surface="dark"
              />
            </div>
            <div className="mt-6 flex gap-4">
              <VooDooLink url={buildStepUrl("note-preferences")} variant="secondary">
                {t("nav.back")}
              </VooDooLink>
              <VooDooLink url={buildStepUrl("season")} variant="primary">
                {t("nav.next")}
              </VooDooLink>
            </div>
          </div>
        )}

        {step === "season" && (
          <div className="mt-8">
            <p className="mb-2 text-stone-300">{t("season.prompt")}</p>
            <p className="mb-4 text-center text-xs text-noir-gold-100/90">
              {t("season.toggleHint")}
            </p>
            <div className="rounded border border-stone-600 bg-stone-800/50 p-4">
              <SeasonSelectionToggleRow
                selection={seasonSelection}
                onChange={setSeasonSelection}
              />
            </div>
            <div className="mt-6 flex gap-4">
              <VooDooLink url={buildStepUrl("avoid-notes")} variant="secondary">
                {t("nav.back")}
              </VooDooLink>
              <VooDooLink url={buildStepUrl("browsing-style")} variant="primary">
                {t("nav.next")}
              </VooDooLink>
            </div>
          </div>
        )}

        {step === "browsing-style" && (
          <form action={formAction} className="mt-8">
            <CSRFToken />
            {[...selectedNoteIds].map((id) => (
              <input key={id} type="hidden" name="noteIds" value={id} />
            ))}
            {[...avoidNoteIds].map((id) => (
              <input key={id} type="hidden" name="avoidNoteIds" value={id} />
            ))}
            {[...selectedSeasonIds].map((id) => (
              <input key={id} type="hidden" name="season" value={id} />
            ))}

            <p className="mb-4 text-stone-300">{t("browse.prompt")}</p>
            <div className="space-y-2">
              {BROWSING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded border border-stone-600 bg-stone-800/50 px-4 py-2 hover:bg-stone-700/50"
                >
                  <input
                    type="radio"
                    name="browsingStyle"
                    value={opt.value}
                    checked={browsingStyle === opt.value}
                    onChange={() => setBrowsingStyle(opt.value)}
                    className="h-4 w-4"
                  />
                  <span>{t(`browse.${opt.labelKey}`)}</span>
                </label>
              ))}
            </div>

            {state?.error && (
              <p className="mt-4 text-red-400" role="alert">
                {state.error}
              </p>
            )}

            <div className="mt-6 flex gap-4">
              <VooDooLink url={buildStepUrl("season")} variant="secondary">
                {t("nav.back")}
              </VooDooLink>
              <Button
                type="submit"
                variant="primary"
                background="gold"
                disabled={isPending}
              >
                {t("nav.save")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
