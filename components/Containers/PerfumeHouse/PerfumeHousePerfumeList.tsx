import { useTranslation } from "react-i18next"
import { NavLink } from "react-router"

import { Button } from "~/components/Atoms/Button"
import { OptimizedImage } from "~/components/Atoms/OptimizedImage"
import bottleBanner from "~/images/single-bottle.webp"
import { validImageRegex } from "~/utils/styleUtils"
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
  const { t } = useTranslation()

  return (
    <div id="data-list" className="rounded-b-lg w-full relative overflow-x-hidden style-scroll">
      <h2 className="text-center mb-4">{t("perfumeHouse.perfumes", {
        defaultValue: "Perfumes",
      })}</h2>

      {loading && perfumes.length === 0 ? (
        <div className="text-center py-6 min-h-[320px] flex items-center justify-center" aria-busy="true">
          {t("singleHouse.loadingPerfumes", {
            defaultValue: "Loading perfumes...",
          })}
        </div>
      ) : perfumes.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-2 pb-4 gap-4">
          {perfumes.map((perfume: any, index: number) => (
            <li key={perfume.id}>
              <NavLink
                viewTransition
                prefetch="intent"
                to={`/perfume/${perfume.slug}`}
                state={selectedLetter ? { selectedLetter } : {}}
                className="block p-2 h-full noir-border relative w-full transition-colors duration-300 ease-in-out"
              >
                <h3 className="text-center block text-lg tracking-wide py-2 font-semibold text-noir-gold leading-6 capitalize">
                  {perfume.name}
                </h3>
                  <OptimizedImage
                    src={!validImageRegex.test(perfume.image) ? perfume.image : bottleBanner}
                    alt={t("singlePerfume.perfumeBottleAltText", {
                      defaultValue: "Perfume Bottle {{name}}",
                      name: perfume.name,
                    })}
                    priority={index < 6}
                    width={192}
                    height={192}
                    quality={75}
                    className="w-48 h-48 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    viewTransitionName={`perfume-image-${perfume.id}`}
                    placeholder="blur"
                  />
              </NavLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-6">
          {t("singleHouse.noPerfumes", {
            defaultValue: "No perfumes are currently listed for this house.",
          })}
        </div>
      )}

      {queryError && (
        <div className="text-center text-red-400 py-4" role="alert">
          {t("singleHouse.errorLoadingPerfumes", {
            defaultValue: "Error loading perfumes.",
          })}
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


