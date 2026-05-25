"use client"

import LinkCard from "@/components/Organisms/LinkCard/LinkCard"
import { useTranslations } from "next-intl"

import type { RecommendationPerfume } from "@/services/recommendations"

import { RecommendationReasonLine } from "./RecommendationReasonLine"

type SimilarPerfumesCarouselProps = {
  similarPerfumes: RecommendationPerfume[]
  selectedLetter: string | null
}

const SimilarPerfumesCarousel = ({
  similarPerfumes,
  selectedLetter,
}: SimilarPerfumesCarouselProps) => {
  const t = useTranslations("singlePerfume")
  const tHouse = useTranslations("singleHouse")

  const list = similarPerfumes ?? []

  if (list.length === 0) return null

  return (
    <section className="w-full max-w-6xl mx-auto">
      <h2 className="text-center mb-4 text-noir-gold-500">
        {t("similarPerfumes", { defaultValue: "Similar perfumes" })}
      </h2>
      <div className="relative pb-4">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-3 z-10 w-12 bg-gradient-to-r from-noir-black via-noir-black/70 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-3 z-10 w-12 bg-gradient-to-l from-noir-black via-noir-black/70 to-transparent"
          aria-hidden
        />
        <ul
          className="relative z-0 flex flex-row gap-4 overflow-x-auto overflow-y-hidden px-2 pt-2 pb-6 style-scroll-noir-cold"
          aria-label={t("similarPerfumes", { defaultValue: "Similar perfumes" })}
        >
          {list.map((p, index) => {
            return (
              <li
                key={p.id}
                className="relative w-56 shrink-0 h-72 transition-colors duration-300 ease-in-out hover:bg-white/5"
              >
                {p.reason && (
                  <RecommendationReasonLine
                    reason={p.reason}
                    className="absolute left-2 bottom-2 z-20"
                    panelClassName="max-w-64 text-left"
                    buttonClassName="opacity-70 scale-90 hover:opacity-100 focus-visible:opacity-100 transition"
                    contentClassName="text-xs leading-snug text-left"
                  />
                )}
                <LinkCard
                  data={{
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    image: p.image ?? undefined,
                    perfumeHouse: p.perfumeHouse ?? undefined,
                  }}
                  type="perfume"
                  selectedLetter={selectedLetter}
                  imageAlt={tHouse("perfumeBottleAltText", { name: p.name })}
                  imagePriority={index < 3}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default SimilarPerfumesCarousel
