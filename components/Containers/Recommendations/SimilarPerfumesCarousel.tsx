"use client"

import { useEffect, useRef, useState } from "react"
import LinkCard from "@/components/Organisms/LinkCard/LinkCard"
import { useTranslations } from "next-intl"

import { useGsapStagger } from "@/hooks/useGsapStagger"
import type { RecommendationPerfume } from "@/services/recommendations"

import { RecommendationReasonLine } from "./RecommendationReasonLine"

type SimilarPerfumesCarouselProps = {
  similarPerfumes: RecommendationPerfume[]
  selectedLetter: string | null
}

const SIMILAR_CARD_STAGGER = 0.05

const SimilarPerfumesCarousel = ({
  similarPerfumes,
  selectedLetter,
}: SimilarPerfumesCarouselProps) => {
  const t = useTranslations("singlePerfume")
  const tHouse = useTranslations("singleHouse")
  const listRef = useRef<HTMLUListElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const list = similarPerfumes ?? []

  useGsapStagger(listRef, {
    selector: "[data-similar-card]",
    deps: [list.map(perfume => perfume.id).join(",")],
    enabled: list.length > 0,
    stagger: SIMILAR_CARD_STAGGER,
    from: { opacity: 0, x: 18, y: 10 },
    to: {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.36,
      ease: "power2.out",
      clearProps: "transform,opacity",
    },
  })

  useEffect(() => {
    const element = listRef.current

    if (!element) {
      return
    }

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0)

      setCanScrollLeft(element.scrollLeft > 8)
      setCanScrollRight(element.scrollLeft < maxScrollLeft - 8)
    }

    updateScrollState()

    element.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    return () => {
      element.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [list.length])

  if (list.length === 0) return null

  return (
    <section className="w-full max-w-6xl mx-auto">
      <h2 className="text-center mb-4 text-noir-gold-500">
        {t("similarPerfumes", { defaultValue: "Similar perfumes" })}
      </h2>
      <div className="relative pb-4">
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-3 z-10 w-12 bg-gradient-to-r from-noir-black via-noir-black/70 to-transparent transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-3 z-10 w-12 bg-gradient-to-l from-noir-black via-noir-black/70 to-transparent transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <ul
          ref={listRef}
          className="relative z-0 flex snap-x snap-mandatory flex-row gap-4 overflow-x-auto overflow-y-hidden px-2 pt-2 pb-6 scroll-px-2 style-scroll-noir-cold"
          aria-label={t("similarPerfumes", { defaultValue: "Similar perfumes" })}
        >
          {list.map((p, index) => {
            return (
              <li
                key={p.id}
                data-similar-card
                className="group relative h-72 w-56 shrink-0 snap-start rounded-xl transition-[transform,background-color,box-shadow,filter] duration-300 ease-out motion-safe:hover:-translate-y-1 hover:bg-white/5 hover:shadow-lg hover:shadow-noir-black/25"
              >
                {p.reason && (
                  <RecommendationReasonLine
                    reason={p.reason}
                    className="absolute left-2 bottom-2 z-20"
                    panelClassName="max-w-64 text-left"
                    buttonClassName="opacity-70 scale-90 hover:opacity-100 focus-visible:opacity-100 transition duration-200"
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
