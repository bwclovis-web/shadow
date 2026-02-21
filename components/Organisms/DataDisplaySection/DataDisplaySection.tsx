import { useTranslation } from "react-i18next"

import { Button } from "@/components/Atoms/Button/Button"

import LinkCard from "../LinkCard/LinkCard"

type DisplayItem = {
  id: string
  name: string
  slug: string
  image?: string
  type?: string
  perfumeHouse?: { name: string }
}

interface DataDisplaySectionProps {
  data: DisplayItem[]
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
  onNextPage?: () => void
  onPrevPage?: () => void
}

const itemNameByType = (type: "house" | "perfume") =>
  type === "house" ? "houses" : "perfumes"

const DataDisplaySection = ({
  data,
  isLoading,
  type,
  selectedLetter,
  sourcePage,
  pagination,
  onNextPage,
  onPrevPage,
}: DataDisplaySectionProps) => {
  const { t } = useTranslation()
  const itemName = itemNameByType(type)

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

  const showPagination =
    pagination && pagination.totalPages > 1

  return (
    <div className="inner-container my-6" id="data-list">
      {isLoading ? (
        <div className="text-center py-8 text-noir-gold">
          {t("common.loading", { itemName })} for letter &quot;{selectedLetter}
          &quot;
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 auto-rows-fr">
          {data.map((item) => (
            <li key={item.id} className="h-full">
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

      {showPagination && pagination && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          {pagination.hasPrevPage && (
            <Button
              onClick={() => onPrevPage?.()}
              variant="secondary"
              size="sm"
            >
              {t("common.previous")}
            </Button>
          )}

          <span className="text-noir-gold/80">
            {t("common.pageOf", {
              current: pagination.currentPage,
              total: pagination.totalPages,
            })}
          </span>

          {pagination.hasNextPage && (
            <Button
              onClick={() => onNextPage?.()}
              variant="secondary"
              size="sm"
            >
              {t("common.next")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default DataDisplaySection
