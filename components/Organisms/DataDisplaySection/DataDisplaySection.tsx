import { useTranslations } from "next-intl"

import { PaginationBar } from "@/components/Molecules/PaginationBar"

import LinkCard from "../LinkCard/LinkCard"

type DisplayItem = {
  id: string
  name: string
  slug: string
  image?: string
  type?: string
  perfumeHouse?: { name: string } | null
}

type PaginationSlice = {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface DataDisplaySectionBaseProps {
  data: DisplayItem[]
  isLoading: boolean
  type: "house" | "perfume"
  selectedLetter: string | null
  sourcePage?: string
}

type DataDisplaySectionProps = DataDisplaySectionBaseProps &
  (
    | {
        pagination?: undefined
        onPageChange?: undefined
      }
    | {
        pagination: PaginationSlice
        onPageChange: (page: number) => void
      }
  )

const itemNameByType = (type: "house" | "perfume") =>
  type === "house" ? "houses" : "perfumes"

const DataDisplaySection = ({
  data,
  isLoading,
  type,
  selectedLetter,
  sourcePage,
  pagination,
  onPageChange,
}: DataDisplaySectionProps) => {
  const tDataDisplay = useTranslations("components.dataDisplaySection")
  const tCommon = useTranslations("common")
  const itemName = itemNameByType(type)

  if (!selectedLetter && data.length === 0) {
    return (
      <div className="inner-container my-6 text-center py-12">
        <h2 className="text-xl text-noir-gold mb-4">
          {tDataDisplay("heading", { itemName })}
        </h2>
        <p className="text-noir-gold/80">
          {tDataDisplay("subheading", { itemName })}
        </p>
      </div>
    )
  }

  const showPagination =
    pagination !== undefined && pagination.totalPages > 1

  return (
    <div className="inner-container my-6 h-60vh" id="data-list">
      {isLoading ? (
        <div className="text-center py-8 text-noir-gold">
          {tCommon("loading")} for letter &quot;{selectedLetter}
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

      {showPagination && pagination && onPageChange && (
        <PaginationBar
          className="mt-8"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}

export default DataDisplaySection
