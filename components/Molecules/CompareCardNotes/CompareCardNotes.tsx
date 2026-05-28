"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"

type PerfumeNote = {
  id: string
  name: string
}

type NoteSection = {
  key: string
  label: string
  notes: PerfumeNote[]
}

type CompareCardNotesProps = {
  perfumeNotesOpen: PerfumeNote[]
  perfumeNotesHeart: PerfumeNote[]
  perfumeNotesClose: PerfumeNote[]
  sharedNoteIds?: ReadonlySet<string>
}

const MAX_VISIBLE_NOTES = 5
const EMPTY_SHARED_NOTE_IDS = new Set<string>()

const dedupeNotes = (groups: PerfumeNote[][]): PerfumeNote[][] => {
  const seenIds = new Set<string>()

  return groups.map(group =>
    group.filter(note => {
      if (seenIds.has(note.id)) {
        return false
      }

      seenIds.add(note.id)
      return true
    })
  )
}

const sortNotesForCompare = (
  notes: PerfumeNote[],
  sharedNoteIds: ReadonlySet<string>
): PerfumeNote[] =>
  [...notes].sort((left, right) => {
    const leftShared = sharedNoteIds.has(left.id)
    const rightShared = sharedNoteIds.has(right.id)

    if (leftShared !== rightShared) {
      return leftShared ? -1 : 1
    }

    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    })
  })

export const CompareCardNotes = ({
  perfumeNotesOpen,
  perfumeNotesHeart,
  perfumeNotesClose,
  sharedNoteIds = EMPTY_SHARED_NOTE_IDS,
}: CompareCardNotesProps) => {
  const t = useTranslations("singlePerfume.notes")

  const sections = useMemo<NoteSection[]>(() => {
    const [dedupedOpen, dedupedHeart, dedupedClose] = dedupeNotes([
      perfumeNotesOpen,
      perfumeNotesHeart,
      perfumeNotesClose,
    ])

    const hasOpen = dedupedOpen.length > 0
    const hasHeart = dedupedHeart.length > 0
    const hasClose = dedupedClose.length > 0
    const noteTypesCount = [hasOpen, hasHeart, hasClose].filter(Boolean).length

    if (noteTypesCount <= 1) {
      const generalNotes = sortNotesForCompare(
        [...dedupedOpen, ...dedupedHeart, ...dedupedClose],
        sharedNoteIds
      )

      return generalNotes.length > 0
        ? [
            {
              key: "general",
              label: t("general"),
              notes: generalNotes,
            },
          ]
        : []
    }

    return [
      {
        key: "opening",
        label: t("opening"),
        notes: sortNotesForCompare(dedupedOpen, sharedNoteIds),
      },
      {
        key: "mid",
        label: t("mid"),
        notes: sortNotesForCompare(dedupedHeart, sharedNoteIds),
      },
      {
        key: "end",
        label: t("end"),
        notes: sortNotesForCompare(dedupedClose, sharedNoteIds),
      },
    ].filter(section => section.notes.length > 0)
  }, [perfumeNotesClose, perfumeNotesHeart, perfumeNotesOpen, sharedNoteIds, t])

  if (sections.length === 0) {
    return null
  }

  return (
    <div className="border-t border-noir-light/10 px-4 py-3">
      <div className="space-y-3">
        {sections.map(section => {
          const visibleNotes = section.notes.slice(0, MAX_VISIBLE_NOTES)
          const hiddenCount = section.notes.length - visibleNotes.length

          return (
            <section key={section.key} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-noir-gold/70">
                {section.label}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {visibleNotes.map(note => {
                  const isShared = sharedNoteIds.has(note.id)

                  return (
                    <li
                      key={note.id}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                        isShared
                          ? "border-noir-gold/35 bg-noir-gold/10 text-noir-gold"
                          : "border-noir-light/10 bg-noir-black/30 text-noir-gold-500"
                      }`}
                    >
                      {note.name}
                    </li>
                  )
                })}
                {hiddenCount > 0 ? (
                  <li className="rounded-full border border-noir-light/10 bg-noir-black/20 px-2.5 py-1 text-xs font-medium text-noir-gold-500">
                    +{hiddenCount}
                  </li>
                ) : null}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
