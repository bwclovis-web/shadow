import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button"

import LinkCard from "../LinkCard/LinkCard"

interface DataDisplaySectionProps {
  data: any[]
  isLoading: boolean
  type: "house" | "perfume"
  selectedLetter: string | null
  sourcePage?: string
  pagination?: {
    currentPage: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  onPageChange?: (page: number) => void
  onNextPage?: () => void
  onPrevPage?: () => void
}

// React Compiler automatically optimizes this component - no manual memo/useMemo needed
function DataDisplaySection({
  data,
  isLoading,
  type,
  selectedLetter,
  sourcePage,
  pagination,
  onPageChange,
  onNextPage,
  onPrevPage,
}: DataDisplaySectionProps) {
  const { t } = useTranslation()
  const itemName = type === "house" ? "houses" : "perfumes"

  if (!selectedLetter && data.length === 0) {
    return (
      <div className="inner-container my-6 text-center py-12">
        <h2 className="text-xl text-noir-gold mb-4">
          {t("components.dataDisplaySection.heading", { itemName })}
        </h2>
        <p className="text-noir-gold/80">
          {t("components.dataDisplaySection.subheading", { itemName })}
        </p>
      </div>
    )
  }

  return (
    <div className="inner-container my-6" id="data-list">
      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 auto-rows-fr">
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            <div className="text-noir-gold">
              {t("common.loading", { itemName })} for letter "{selectedLetter}
              "...
            </div>
          </div>
        ) : (
          data.map((item: any) => (
            <li key={item.id} className="h-full">
              <LinkCard
                data={item}
                type={type}
                selectedLetter={selectedLetter}
                sourcePage={sourcePage}
              />
            </li>
          ))
        )}
      </ul>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          {pagination.hasPrevPage && (
            <Button
              onClick={() => onPrevPage?.()}
              variant="secondary"
              size="sm"
            >
              Previous
            </Button>
          )}

          <span className="text-noir-gold/80">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          {pagination.hasNextPage && (
            <Button
              onClick={() => onNextPage?.()}
              variant="secondary"
              size="sm"
            >
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default DataDisplaySection
