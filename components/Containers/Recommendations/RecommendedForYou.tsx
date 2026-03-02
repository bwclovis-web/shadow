import Image from "next/image"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"

import type { RecommendationPerfume } from "@/services/recommendations"
import { validImageRegex } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

const PERFUME_LIMIT = 6

interface RecommendedForYouProps {
  perfumes: RecommendationPerfume[]
  /** Optional limit to show (default 6). */
  limit?: number
}

const RecommendedForYou = ({ perfumes, limit = PERFUME_LIMIT }: RecommendedForYouProps) => {
  const tRecommendations = useTranslations("recommendations")
  const tSingleHouse = useTranslations("singleHouse")
  const list = (perfumes ?? []).slice(0, limit)

  if (list.length === 0) return null

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-center mb-4 text-noir-gold-500">
        {tRecommendations("recommendedForYou")}
      </h2>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
        {list.map((similar, index) => (
          <li key={similar.id}>
            <Link
              href={`/perfume/${similar.slug}`}
              prefetch={true}
              className="block p-2 h-full noir-border relative w-full transition-colors duration-300 ease-in-out hover:bg-white/5"
            >
              <h3 className="text-center block text-sm tracking-wide py-2 font-semibold text-noir-gold leading-tight capitalize line-clamp-2">
                {similar.name}
              </h3>
              <Image
                src={
                  (!validImageRegex.test(similar.image ?? "") ? similar.image : null) ??
                  BOTTLE_PLACEHOLDER
                }
                alt={tSingleHouse("perfumeBottleAltText", { name: similar.name })}
                priority={index < 3}
                width={128}
                height={128}
                quality={75}
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                style={
                  { viewTransitionName: `perfume-image-${similar.id}` } as React.CSSProperties
                }
              />
              {similar.perfumeHouse && (
                <p className="text-center text-xs text-noir-gold-500/80 truncate">
                  {similar.perfumeHouse.name}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RecommendedForYou
