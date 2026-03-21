import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import LinkCard from "@/components/Organisms/LinkCard"
interface PaginationState {
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  totalCount: number
  pageSize: number
}

interface PerfumeHousePerfumeListProps {
  perfumes: any[]
  loading: boolean
  pagination: PaginationState
  onNextPage: () => void
  onPrevPage: () => void
  selectedLetter?: string | null
  queryError?: Error | null
}

const PerfumeHousePerfumeList = ({
  perfumes,
  loading,
  pagination,
  onNextPage,
  onPrevPage,
  selectedLetter,
  queryError,
}: PerfumeHousePerfumeListProps) => {
  const tSingleHouse = useTranslations("singleHouse")

  return (
    <div id="data-list" className="rounded-b-lg w-full relative">
      <h2 className="text-center mb-4">{tSingleHouse("perfumes")}</h2>

      {loading && perfumes.length === 0 ? (
        <div className="text-center py-6 min-h-[320px] flex items-center justify-center" aria-busy="true">
          {tSingleHouse("loadingPerfumes")}
        </div>
      ) : perfumes.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-2 pb-4 gap-4">
          {perfumes.map((perfume: any, index: number) => (
            <li key={perfume.id} className="h-full">
              <LinkCard
                type="perfume"
                data={{
                  id: String(perfume.id),
                  name: perfume.name,
                  slug: perfume.slug,
                  image: perfume.image,
                }}
                selectedLetter={selectedLetter}
                imageAlt={tSingleHouse("perfumeBottleAltText", { name: perfume.name })}
                imagePriority={index < 6}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-6">
          {tSingleHouse("noPerfumes")}
        </div>
      )}

      {queryError && (
        <div className="text-center text-red-400 py-4" role="alert">
          {tSingleHouse("errorLoadingPerfumes")}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-6">
          {pagination.hasPrevPage && (
            <Button onClick={onPrevPage} variant="secondary" size="sm">
              Previous
            </Button>
          )}
          <span className="text-noir-gold/80">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          {pagination.hasNextPage && (
            <Button onClick={onNextPage} variant="secondary" size="sm">
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default PerfumeHousePerfumeList


