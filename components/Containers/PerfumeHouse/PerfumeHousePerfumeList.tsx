import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import { Button } from "@/components/Atoms/Button"
import { PERFUME_PATH } from "@/constants/routes"
import { validImageRegex } from "@/utils/styleUtils"
import Image from "next/image"
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
          {perfumes.map((perfume: any, index: number) => {
            const href = selectedLetter
              ? `${PERFUME_PATH}/${perfume.slug}?letter=${selectedLetter}`
              : `${PERFUME_PATH}/${perfume.slug}`
            return (
            <li key={perfume.id} className="h-full">
              <div className="relative w-full h-full noir-border overflow-hidden transition-all duration-300 ease-in-out">
              <Link
                href={href}
                className="block p-2 h-full relative w-full transition-colors duration-300 ease-in-out"
              >
                <h3 className="text-center block text-lg tracking-wide py-2 font-semibold text-noir-gold leading-6 capitalize">
                  {perfume.name}
                </h3>
                  <Image
                    src={!validImageRegex.test(perfume.image) ? perfume.image : "/images/single-bottle.webp"}
                    alt={tSingleHouse("perfumeBottleAltText", { name: perfume.name })}
                    priority={index < 6}
                    width={192}
                    height={192}
                    quality={75}
                    className="w-48 h-48 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    style={{ viewTransitionName: `perfume-image-${perfume.id}` } as React.CSSProperties}
                  />
              </Link>
              </div>
            </li>
          )})}
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


