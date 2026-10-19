import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { EXCHANGE_OFFER_PAGE_SIZE } from "@/utils/exchange-constants"

export type ExchangeOffersQueryParams = {
  perfumeId: string
  /** Serialized discovery + q (from current URL search, excluding pg). */
  filterQueryString: string
  cursor?: string | null
  take?: number
}

export type ExchangeOffersApiResponse = {
  offers: ExchangeOfferDto[]
  nextCursor: string | null
  pageSize: number
  queryKey?: {
    perfumeId: string
    cursor: string | null
    take: number
    viewer: string
    filters: string
  }
  error?: string
}

export const exchangeOffersQueryKeys = {
  all: ["exchange-offers"] as const,
  page: (params: ExchangeOffersQueryParams & { viewer: string }) =>
    [
      ...exchangeOffersQueryKeys.all,
      params.perfumeId,
      params.filterQueryString,
      params.cursor ?? "",
      params.take ?? EXCHANGE_OFFER_PAGE_SIZE,
      params.viewer,
    ] as const,
}

export const fetchExchangeOffersPage = async (
  params: ExchangeOffersQueryParams
): Promise<ExchangeOffersApiResponse> => {
  const search = new URLSearchParams(params.filterQueryString)
  search.set("perfumeId", params.perfumeId)
  if (params.cursor) search.set("cursor", params.cursor)
  if (params.take != null) search.set("take", String(params.take))

  const res = await fetch(`/api/exchange/offers?${search.toString()}`, {
    credentials: "include",
  })
  const body = (await res.json()) as ExchangeOffersApiResponse
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to load offers")
  }
  return body
}
