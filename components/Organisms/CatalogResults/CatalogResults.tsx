"use client"

import { type ReactNode, useRef } from "react"

import {
  CatalogItemCard,
  type CatalogItemDisplay,
  CatalogItemRow,
} from "@/components/Molecules/CatalogItem/CatalogItem"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { CATALOG_RESULTS_ID, type CatalogView } from "@/utils/catalog-params"
import { CARD_STAGGER_DEFAULT } from "@/utils/card-motion"
import { styleMerge } from "@/utils/styleUtils"

export type CatalogResultsProps = {
  heading: string
  items: CatalogItemDisplay[]
  view: CatalogView
  actionLabel: string
  isPending: boolean
  pendingLabel: string
  emptyState: ReactNode
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Rendered between the heading and the items (e.g. Save search). */
  aside?: ReactNode
}

const CatalogResults = ({
  heading,
  items,
  view,
  actionLabel,
  isPending,
  pendingLabel,
  emptyState,
  page,
  totalPages,
  onPageChange,
  aside,
}: CatalogResultsProps) => {
  const listRef = useRef<HTMLUListElement>(null)

  useGsapStagger(listRef, {
    selector: "[data-catalog-item]",
    deps: [view, items.map(item => item.id).join(",")],
    enabled: items.length > 0,
    ...CARD_STAGGER_DEFAULT,
  })

  return (
    <section
      id={CATALOG_RESULTS_ID}
      aria-labelledby={`${CATALOG_RESULTS_ID}-heading`}
      aria-busy={isPending}
      className="scroll-mt-28"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id={`${CATALOG_RESULTS_ID}-heading`} className="!text-xl md:!text-2xl !font-semibold">
          {heading}
        </h2>
        <p role="status" className="text-sm text-noir-gold-100">
          {isPending ? pendingLabel : ""}
        </p>
      </div>
      {aside}
      <div
        className={styleMerge(
          "transition-opacity duration-200",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {items.length === 0 ? (
          emptyState
        ) : (
          <ul
            ref={listRef}
            className={
              view === "grid"
                ? "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
                : "flex flex-col gap-2 md:gap-0"
            }
          >
            {items.map((item, index) => (
              <li key={item.id} data-catalog-item className="h-full">
                {view === "grid" ? (
                  <CatalogItemCard item={item} imagePriority={index < 4} />
                ) : (
                  <CatalogItemRow item={item} actionLabel={actionLabel} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {totalPages > 1 ? (
        <PaginationBar
          className="mt-8"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      ) : null}
    </section>
  )
}

export default CatalogResults
