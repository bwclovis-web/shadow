"use client"

import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import PerfumeNotes from "@/components/Containers/Perfume/PerfumeNotes"
import { PerfumeAggregateRatingsSummary } from "@/components/Molecules/PerfumeAggregateRatingsSummary/PerfumeAggregateRatingsSummary"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { HOUSE_DETAIL_PATH } from "@/constants/routes"
import { useComparePayload } from "@/hooks/useComparePayload"
import { useCompareStore, type CompareItem } from "@/hooks/compareStore"
import {
  comparePersonalizeQueryKeys,
  fetchComparePersonalize,
  fetchComparePerfumes,
} from "@/lib/queries/compare"
import type { ComparePerfumeDto } from "@/models/compare.server"
import { compareIdsExceedMax, normalizeCompareIds } from "@/utils/compare-ids"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"

const BANNER_IMAGE = "/images/vault.webp"
const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
const VAULT_PATH = "/the-vault"
const EXCHANGE_PATH = "/the-exchange"

function dtoToCompareItem(dto: ComparePerfumeDto): CompareItem {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    image: dto.image ?? undefined,
  }
}

function CompareColumn({
  item,
  dto,
  bestForYou,
  bestForYouNoteList,
}: {
  item: { id: string; name: string; slug: string; image?: string }
  dto: ComparePerfumeDto | undefined
  bestForYou?: boolean
  bestForYouNoteList?: string
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
      {bestForYou ? (
        <div
          className="mx-3 mt-3 rounded-sm border border-noir-gold/50 bg-noir-gold/10 px-3 py-2 text-center"
          data-testid="compare-best-for-you"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-noir-gold">
            {t("bestForYouTitle")}
          </p>
          {bestForYouNoteList ? (
            <p className="mt-1 text-xs text-noir-gold-500 leading-snug">
              {t("bestForYouBody", { noteList: bestForYouNoteList })}
            </p>
          ) : null}
        </div>
      ) : null}
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

function ComparePageSuspenseFallback() {
  const t = useTranslations("compare")
  const tCommon = useTranslations("common")
  return (
    <section className="relative z-10 min-h-screen pb-4">
      <TitleBanner image={BANNER_IMAGE} heading={t("pageHeading")} subheading={t("pageSubheading")} />
      <div className="inner-container py-8">
        <p className="text-center text-noir-gold-500">{tCommon("loading")}</p>
      </div>
    </section>
  )
}

function ComparePageInner({ userId }: { userId: string | null }) {
  const t = useTranslations("compare")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items = useCompareStore((s) => s.items)
  const setItems = useCompareStore((s) => s.setItems)

  const idsParam = searchParams.get("ids")
  const urlIds = useMemo(
    () => (idsParam ? normalizeCompareIds(idsParam.split(",")) : []),
    [idsParam]
  )

  const [invalidLinkNotice, setInvalidLinkNotice] = useState(false)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")

  useEffect(() => {
    if (!idsParam?.trim()) return
    const parsed = normalizeCompareIds(idsParam.split(","))
    if (!compareIdsExceedMax(parsed)) return
    setInvalidLinkNotice(true)
    router.replace("/compare", { scroll: false })
  }, [idsParam, router])

  useEffect(() => {
    if (!invalidLinkNotice) return
    const timer = setTimeout(() => setInvalidLinkNotice(false), 8000)
    return () => clearTimeout(timer)
  }, [invalidLinkNotice])

  const hydrateKeyRef = useRef<string | null>(null)
  const urlSyncBlockRef = useRef(false)

  useEffect(() => {
    if (urlIds.length === 0) {
      hydrateKeyRef.current = null
      return
    }
    if (compareIdsExceedMax(urlIds)) return

    const key = urlIds.join("|")
    if (hydrateKeyRef.current === key) return

    let cancelled = false
    hydrateKeyRef.current = key
    urlSyncBlockRef.current = true

    void fetchComparePerfumes(urlIds)
      .then((data) => {
        if (cancelled) return
        const mapped: CompareItem[] = urlIds.map((id) => {
          const dto = data.find((p) => p.id === id)
          if (dto) return dtoToCompareItem(dto)
          return { id, slug: "", name: id, image: undefined }
        })
        setItems(mapped)
      })
      .finally(() => {
        if (!cancelled) urlSyncBlockRef.current = false
      })

    return () => {
      cancelled = true
      urlSyncBlockRef.current = false
    }
  }, [urlIds, setItems])

  const orderedIds = useMemo(() => items.map((i) => i.id), [items])

  useEffect(() => {
    if (pathname !== "/compare") return
    if (urlSyncBlockRef.current) return

    const desired = orderedIds.join(",")
    const currentRaw = searchParams.get("ids")
    const currentNorm = currentRaw
      ? normalizeCompareIds(currentRaw.split(",")).join(",")
      : ""

    if (currentNorm === desired) return

    const next =
      orderedIds.length > 0
        ? `/compare?ids=${orderedIds.map(encodeURIComponent).join(",")}`
        : "/compare"

    router.replace(next, { scroll: false })
  }, [orderedIds, pathname, router, searchParams])

  const { data, isLoading, isError, error, refetch } = useComparePayload(orderedIds)

  const { data: personalize } = useQuery({
    queryKey: comparePersonalizeQueryKeys.byOrderedIds(orderedIds),
    queryFn: () => fetchComparePersonalize(orderedIds),
    enabled: Boolean(userId) && orderedIds.length > 0,
  })

  const dtoById = useMemo(() => {
    const m = new Map<string, ComparePerfumeDto>()
    for (const p of data ?? []) {
      m.set(p.id, p)
    }
    return m
  }, [data])

  const winnerNoteList = useMemo(() => {
    const notes = personalize?.explainNotes ?? []
    if (notes.length === 0) return ""
    return notes.map((n) => n.name).join(", ")
  }, [personalize?.explainNotes])

  const copyShareLink = useCallback(async () => {
    if (orderedIds.length === 0) return
    const qs = `ids=${orderedIds.map(encodeURIComponent).join(",")}`
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${pathname}?${qs}`
        : ""
    try {
      await navigator.clipboard.writeText(url)
      setCopyState("copied")
      setTimeout(() => setCopyState("idle"), 2500)
    } catch {
      setCopyState("error")
      setTimeout(() => setCopyState("idle"), 4000)
    }
  }, [orderedIds, pathname])

  return (
    <section className="relative z-10 min-h-screen pb-4">
      <TitleBanner image={BANNER_IMAGE} heading={t("pageHeading")} subheading={t("pageSubheading")} />

      <div className="inner-container py-8">
        {invalidLinkNotice ? (
          <div
            className="max-w-6xl mx-auto mb-4 rounded-sm border border-amber-600/40 bg-amber-900/20 px-4 py-3 text-sm text-noir-gold-100"
            role="status"
          >
            {t("invalidCompareUrl")}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void copyShareLink()}
              >
                {t("copyShareLink")}
              </Button>
              {copyState === "copied" ? (
                <span className="text-sm text-noir-gold-500">{t("linkCopied")}</span>
              ) : null}
              {copyState === "error" ? (
                <span className="text-sm text-red-300/90">{t("copyLinkError")}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {!userId && items.length > 0 ? (
          <p className="max-w-6xl mx-auto mb-6 text-center text-sm text-noir-gold-500">
            {t("personalizeHint")}
          </p>
        ) : null}

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
              <CompareColumn
                key={item.id}
                item={item}
                dto={dtoById.get(item.id)}
                bestForYou={
                  Boolean(personalize?.winnerId) && personalize?.winnerId === item.id
                }
                bestForYouNoteList={
                  personalize?.winnerId === item.id ? winnerNoteList : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function ComparePageClient({ userId }: { userId: string | null }) {
  return (
    <Suspense fallback={<ComparePageSuspenseFallback />}>
      <ComparePageInner userId={userId} />
    </Suspense>
  )
}
