"use client"

import { useMemo, useRef } from "react"
import { useTranslations } from "next-intl"

import { useGsapStagger } from "@/hooks/useGsapStagger"

interface PerfumeNote {
  id: string
  name: string
}

interface PerfumeNotesProps {
  perfumeNotesOpen: PerfumeNote[]
  perfumeNotesHeart: PerfumeNote[]
  perfumeNotesClose: PerfumeNote[]
}

type NoteSection = {
  key: string
  label: string
  notes: PerfumeNote[]
}

// Legacy "show first N notes" toggle kept for quick re-enable.
// const MAX_VISIBLE_NOTES = 8

const sortNotesAlphabetically = (notes: PerfumeNote[]): PerfumeNote[] =>
  [...notes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )

const PerfumeNotes = ({
  perfumeNotesOpen,
  perfumeNotesHeart,
  perfumeNotesClose,
}: PerfumeNotesProps) => {
  const t = useTranslations("singlePerfume.notes")
  const containerRef = useRef<HTMLDivElement>(null)

  const { dedupedOpen, dedupedHeart, dedupedClose } = useMemo(() => {
    const seenIds = new Set<string>()
    const dedupe = (notes: PerfumeNote[]) =>
      notes.filter(note => {
        if (seenIds.has(note.id)) {
          return false
        }

        seenIds.add(note.id)
        return true
      })

    return {
      dedupedOpen: dedupe(perfumeNotesOpen),
      dedupedHeart: dedupe(perfumeNotesHeart),
      dedupedClose: dedupe(perfumeNotesClose),
    }
  }, [perfumeNotesClose, perfumeNotesHeart, perfumeNotesOpen])

  const sections = useMemo<NoteSection[]>(() => {
    const hasOpen = dedupedOpen.length > 0
    const hasHeart = dedupedHeart.length > 0
    const hasClose = dedupedClose.length > 0
    const noteTypesCount = [hasOpen, hasHeart, hasClose].filter(Boolean).length

    if (noteTypesCount <= 1) {
      return [
        {
          key: "general",
          label: t("general"),
          notes: sortNotesAlphabetically([
            ...dedupedOpen,
            ...dedupedHeart,
            ...dedupedClose,
          ]),
        },
      ].filter(section => section.notes.length > 0)
    }

    return [
      {
        key: "opening",
        label: t("opening"),
        notes: sortNotesAlphabetically(dedupedOpen),
      },
      {
        key: "mid",
        label: t("mid"),
        notes: sortNotesAlphabetically(dedupedHeart),
      },
      {
        key: "end",
        label: t("end"),
        notes: sortNotesAlphabetically(dedupedClose),
      },
    ].filter(section => section.notes.length > 0)
  }, [dedupedClose, dedupedHeart, dedupedOpen, t])

  const sectionSignature = sections
    .map(section => `${section.key}:${section.notes.map(note => note.id).join(",")}`)
    .join("|")

  useGsapStagger(containerRef, {
    selector: "[data-note-group]",
    deps: [sectionSignature],
    enabled: sections.length > 0,
    stagger: 0.06,
    from: { opacity: 0, y: 10 },
    to: {
      opacity: 1,
      y: 0,
      duration: 0.3,
      ease: "power2.out",
      clearProps: "transform,opacity",
    },
  })

  if (sections.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-xl bg-noir-dark p-4 text-noir-gold-100 ${
        sections.length > 1 ? "grid grid-cols-1 gap-4 md:grid-cols-3" : "space-y-3"
      }`}
    >
      {sections.map((section, index) => {
        const visibleNotes = section.notes
        // Legacy collapsed-notes behavior (kept commented for later use):
        // const isExpanded = Boolean(expandedSections[section.key])
        // const visibleNotes = isExpanded
        //   ? section.notes
        //   : section.notes.slice(0, MAX_VISIBLE_NOTES)
        // const hiddenCount = section.notes.length - visibleNotes.length

        return (
          <section
            key={section.key}
            data-note-group
            className={`rounded-xl border border-noir-gold/15 bg-noir-black/20 p-4 transition-colors duration-300 ${
              sections.length > 1 && index < sections.length - 1
                ? "md:border-r md:border-r-noir-gold/20"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-medium tracking-wide text-noir-gold">
                {section.label}
              </h3>
              {/* Legacy "+N" expand button; disabled so all notes are always shown. */}
              {/* {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections(prev => ({
                      ...prev,
                      [section.key]: true,
                    }))
                  }
                  aria-label={tCommon("loadMore", {
                    itemName: section.label.toLowerCase(),
                  })}
                  className="rounded-full border border-noir-gold/20 bg-noir-gold/10 px-2.5 py-1 text-xs font-semibold text-noir-gold transition-[transform,background-color,border-color,color] duration-200 motion-safe:hover:-translate-y-0.5 hover:border-noir-gold/35 hover:bg-noir-gold/15"
                >
                  +{hiddenCount}
                </button>
              )} */}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {visibleNotes.map(note => (
                <li
                  key={note.id}
                  className="rounded-full border border-noir-gold/20 bg-noir-black/35 px-3 py-1 text-sm font-semibold capitalize text-noir-gold-100"
                >
                  {note.name}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default PerfumeNotes
