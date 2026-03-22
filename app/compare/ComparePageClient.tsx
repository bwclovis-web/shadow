"use client"

import Image from "next/image"
import { useMemo } from "react"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PerfumeNotes from "@/components/Containers/Perfume/PerfumeNotes"
import { PerfumeAggregateRatingsSummary } from "@/components/Molecules/PerfumeAggregateRatingsSummary"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { HOUSE_DETAIL_PATH } from "@/constants/routes"
import { useComparePayload } from "@/hooks/useComparePayload"
import { useCompareStore } from "@/hooks/compareStore"
import type { ComparePerfumeDto } from "@/models/compare.server"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"

const BANNER_IMAGE = "/images/vault.webp"
const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const VAULT_PATH = "/the-vault"
const EXCHANGE_PATH = "/the-exchange"

function CompareColumn({
  item,
  dto,
}: {
  item: { id: string; name: string; slug: string; image?: string }
  dto: ComparePerfumeDto | undefined
}) {
  const t = useTranslations("compare")
  const tHouse = useTranslations("singleHouse")

  const normalized = normalizeRemoteImageSrc(dto?.image ?? item.image)
  const showRemote = normalized && !validImageRegex.test(normalized)
  const imgSrc = showRemote ? normalized : BOTTLE_PLACEHOLDER

  if (!dto) {
    return (
      <div
        className="noir-border bg-white/5 p-4 flex flex-col gap-3 min-h-[200px]"
        data-testid="compare-column-missing"
      >
        <h2 className="text-lg font-semibold text-noir-gold text-center capitalize">
          {item.name}
        </h2>
        <p className="text-sm text-noir-gold-500 text-center">{t("loadError")}</p>
      </div>
    )
  }

  const exchangeHref = `${EXCHANGE_PATH}?q=${encodeURIComponent(dto.name)}`

  return (
    <article className="noir-border bg-white/5 flex flex-col gap-3 overflow-hidden">
      <PrefetchLink
        href={`/perfume/${dto.slug}`}
        className="block p-4 text-center hover:bg-white/5 transition-colors"
      >
        <Image
          src={imgSrc}
          alt={tHouse("perfumeBottleAltText", { name: dto.name })}
          width={160}
          height={160}
          className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-lg mx-auto mb-2"
          sizes="(max-width: 1024px) 40vw, 160px"
        />
        <h2 className="text-lg font-semibold text-noir-gold capitalize leading-tight">
          {dto.name}
        </h2>
      </PrefetchLink>

      <div className="px-4 pb-2 text-center text-sm text-noir-gold-500">
        {dto.perfumeHouse ? (
          <>
            {t("byHouse")}{" "}
            <PrefetchLink
              className="text-blue-200 hover:underline font-semibold"
              href={`${HOUSE_DETAIL_PATH}/${dto.perfumeHouse.slug}`}
            >
              {dto.perfumeHouse.name}
            </PrefetchLink>
          </>
        ) : (
          <span>{t("houseUnknown")}</span>
        )}
      </div>

      <div className="border-t border-noir-light/10">
        <PerfumeNotes
          perfumeNotesOpen={dto.perfumeNotesOpen}
          perfumeNotesHeart={dto.perfumeNotesHeart}
          perfumeNotesClose={dto.perfumeNotesClose}
        />
      </div>

      {dto.description ? (
        <p className="px-4 text-sm text-noir-gold-500 line-clamp-4">{dto.description}</p>
      ) : null}

      <div className="px-4">
        <PerfumeAggregateRatingsSummary averageRatings={dto.averageRatings} />
      </div>

      <div className="px-4 pb-4 text-sm text-noir-gold-100">
        <p className="font-medium text-noir-gold mb-1">{t("availability")}</p>
        <p className="text-noir-gold-500">
          {t("listingCount", { count: dto.exchangeListingCount })}
        </p>
        <PrefetchLink
          href={exchangeHref}
          className="inline-block mt-2 text-blue-200 hover:underline font-semibold text-sm"
        >
          {t("viewOnExchange")}
        </PrefetchLink>
      </div>
    </article>
  )
}

export default function ComparePageClient() {
  const t = useTranslations("compare")
  const tCommon = useTranslations("common")
  const items = useCompareStore((s) => s.items)
  const orderedIds = useMemo(() => items.map((i) => i.id), [items])

  const { data, isLoading, isError, error, refetch } = useComparePayload(orderedIds)

  const dtoById = useMemo(() => {
    const m = new Map<string, ComparePerfumeDto>()
    for (const p of data ?? []) {
      m.set(p.id, p)
    }
    return m
  }, [data])

  return (
    <section className="relative z-10 min-h-screen pb-4">
      <TitleBanner image={BANNER_IMAGE} heading={t("pageHeading")} subheading={t("pageSubheading")} />

      <div className="inner-container py-8">
        {items.length === 0 ? (
          <div className="max-w-6xl mx-auto text-center py-12">
            <h2 className="text-xl text-noir-gold mb-4">{t("emptyTitle")}</h2>
            <p className="text-noir-gold/80 mb-6">{t("emptyBody")}</p>
            <PrefetchLink
              href={VAULT_PATH}
              className="inline-flex rounded-sm border border-noir-gold bg-noir-gold/10 px-4 py-2 text-noir-gold font-semibold hover:bg-noir-gold/20 transition-colors"
            >
              {t("emptyCta")}
            </PrefetchLink>
          </div>
        ) : isLoading ? (
          <p className="text-center text-noir-gold-500">{tCommon("loading")}</p>
        ) : isError ? (
          <div className="max-w-6xl mx-auto text-center py-8">
            <p className="text-noir-gold mb-4">
              {error instanceof Error ? error.message : t("loadError")}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className={styleMerge(
                "rounded-sm border border-noir-gold px-4 py-2 text-sm font-semibold",
                "bg-noir-dark text-noir-gold hover:bg-noir-black"
              )}
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <div
            className={styleMerge(
              "max-w-6xl mx-auto grid gap-4",
              "grid-cols-1 lg:grid-cols-3"
            )}
          >
            {items.map((item) => (
              <CompareColumn key={item.id} item={item} dto={dtoById.get(item.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
