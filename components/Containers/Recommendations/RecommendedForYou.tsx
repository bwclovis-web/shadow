import { useTranslation } from "react-i18next"
import { NavLink } from "react-router"

import { OptimizedImage } from "~/components/Atoms/OptimizedImage"
import type { RecommendationPerfume } from "~/services/recommendations"
import bottleBanner from "~/images/single-bottle.webp"
import { validImageRegex } from "~/utils/styleUtils"

const PERFUME_LIMIT = 6

interface RecommendedForYouProps {
  perfumes: RecommendationPerfume[]
  /** Optional limit to show (default 6). */
  limit?: number
}

export default function RecommendedForYou({ perfumes, limit = PERFUME_LIMIT }: RecommendedForYouProps) {
  const { t } = useTranslation()
  const list = (perfumes ?? []).slice(0, limit)
  if (list.length === 0) return null

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-center mb-4 text-noir-gold-500">
        {t("recommendations.recommendedForYou", { defaultValue: "Recommended for you" })}
      </h2>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
        {list.map((similar, index) => (
          <li key={similar.id}>
            <NavLink
              viewTransition
              prefetch="intent"
              to={`/perfume/${similar.slug}`}
              className="block p-2 h-full noir-border relative w-full transition-colors duration-300 ease-in-out hover:bg-white/5"
            >
              <h3 className="text-center block text-sm tracking-wide py-2 font-semibold text-noir-gold leading-tight capitalize line-clamp-2">
                {similar.name}
              </h3>
              <OptimizedImage
                src={
                  (!validImageRegex.test(similar.image ?? "") ? similar.image : null) ?? bottleBanner
                }
                alt={t("singlePerfume.perfumeBottleAltText", {
                  defaultValue: "Perfume Bottle {{name}}",
                  name: similar.name,
                })}
                priority={index < 3}
                width={128}
                height={128}
                quality={75}
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                viewTransitionName={`perfume-image-${similar.id}`}
                placeholder="blur"
              />
              {similar.perfumeHouse && (
                <p className="text-center text-xs text-noir-gold-500/80 truncate">
                  {similar.perfumeHouse.name}
                </p>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
