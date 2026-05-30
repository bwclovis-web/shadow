import { useTranslations } from "next-intl"
import { type RefObject } from "react"

import { PaginationBar } from "@/components/Molecules/PaginationBar"

import LinkCard from "../LinkCard/LinkCard"

type DisplayItem = {
  id: string
  name: string
  slug: string
  image?: string
  type?: string
  isPending?: boolean
  perfumeHouse?: { name: string } | null
}

type PaginationSlice = {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

type RevealCueDirection = "forward" | "backward"
type RevealCueTone = "archive" | "houses"

interface DataDisplaySectionBaseProps {
  data: DisplayItem[]
  isLoading: boolean
  type: "house" | "perfume"
  selectedLetter: string | null
  sourcePage?: string
  containerRef?: RefObject<HTMLDivElement | null>
  transitionCueKey?: string
  transitionCueDirection?: RevealCueDirection
  transitionCueTone?: RevealCueTone
}

type DataDisplaySectionProps = DataDisplaySectionBaseProps &
  (
    | {
        pagination?: undefined
        onPageChange?: undefined
        onPrefetchNext?: undefined
        onPrefetchPage?: undefined
      }
    | {
        pagination: PaginationSlice
        onPageChange: (page: number) => void
        onPrefetchNext?: () => void
        onPrefetchPage?: (page: number) => void
      }
  )

const DataDisplaySection = ({
  data,
  isLoading,
  type,
  selectedLetter,
  sourcePage,
  containerRef,
  transitionCueKey,
  transitionCueDirection = "forward",
  transitionCueTone = "archive",
  pagination,
  onPageChange,
  onPrefetchNext,
  onPrefetchPage,
}: DataDisplaySectionProps) => {
  const tDataDisplay = useTranslations("components.dataDisplaySection")
  const tCommon = useTranslations("common")
  const isArchiveBrowse = type === "perfume"
  const cueBarClassName =
    transitionCueTone === "archive"
      ? "bg-gradient-to-r from-transparent via-noir-gold to-transparent"
      : "bg-gradient-to-r from-transparent via-noir-gold-100 to-transparent"

  if (!selectedLetter && data.length === 0) {
    const heading = isArchiveBrowse
      ? tDataDisplay("headingArchive")
      : tDataDisplay("headingHouses")
    const subheading = isArchiveBrowse
      ? tDataDisplay("subheadingArchive")
      : tDataDisplay("subheadingHouses")

    return (
      <div className="text-center pb-6">
        <h2>{heading}</h2>
        <p className="text-noir-gold/80">{subheading}</p>
      </div>
    )
  }

  const showPagination =
    pagination !== undefined && pagination.totalPages > 1

  return (
    <div className="relative mt-6 h-70vh" id="data-list" ref={containerRef}>
      {transitionCueKey ? (
        <div
          key={`${transitionCueKey}-${transitionCueDirection}-${transitionCueTone}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 z-10 h-16 overflow-hidden"
        >
          <div
            className={`absolute top-0 h-px w-2/5 ${cueBarClassName} ${
              transitionCueDirection === "forward"
                ? "motion-safe:animate-grid-cue-forward"
                : "motion-safe:animate-grid-cue-backward"
            }`}
          />
        </div>
      ) : null}
      {isLoading ? (
        <div className="text-center py-8 text-noir-gold">
          {tCommon("loading")} for letter &quot;{selectedLetter}
          &quot;
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 auto-rows-fr">
          {data.map((item) => (
            <li key={item.id} className="h-full" data-display-card>
              <LinkCard
                data={item}
                type={type}
                selectedLetter={selectedLetter}
                sourcePage={sourcePage}
              />
            </li>
          ))}
        </ul>
      )}

      {showPagination && pagination && onPageChange && (
        <PaginationBar
          className="mt-8"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          onPrefetchNext={onPrefetchNext}
          onPrefetchPage={onPrefetchPage}
        />
      )}
    </div>
  )
}

export default DataDisplaySection
