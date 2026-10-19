import { NextRequest, NextResponse } from "next/server"

import { getExchangeMatchingOffersPage } from "@/models/perfume-exchange-groups.server"
import { EXCHANGE_OFFER_PAGE_SIZE } from "@/utils/exchange-constants"
import {
  discoveryFiltersToSearchParams,
  parseDiscoveryFiltersFromSearchParams,
} from "@/utils/discovery-filters"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

/**
 * On-demand matching offers for one fragrance (cursor pages of
 * {@link EXCHANGE_OFFER_PAGE_SIZE}). Uses the same eligibility as browse groups.
 * Not cached: includes viewer exclusion when signed in.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl
  const perfumeId = searchParams.get("perfumeId")?.trim() ?? ""
  if (!isValidPrismaRecordId(perfumeId)) {
    return NextResponse.json({ error: "Invalid perfumeId" }, { status: 400 })
  }

  const cursorRaw = searchParams.get("cursor")?.trim() ?? ""
  const cursor =
    cursorRaw && isValidPrismaRecordId(cursorRaw) ? cursorRaw : null

  const takeRaw = parseInt(searchParams.get("take") ?? "", 10)
  const take = Number.isFinite(takeRaw)
    ? Math.min(Math.max(takeRaw, 1), EXCHANGE_OFFER_PAGE_SIZE)
    : EXCHANGE_OFFER_PAGE_SIZE

  const discovery = parseDiscoveryFiltersFromSearchParams(searchParams)
  const searchQuery = (searchParams.get("q") ?? "").trim() || undefined

  // Ensure we only forward known discovery keys (stable query identity).
  const normalized = discoveryFiltersToSearchParams(
    discovery,
    new URLSearchParams()
  )
  if (searchQuery) normalized.set("q", searchQuery)

  const session = await getSessionFromCookieHeader(
    request.headers.get("cookie") ?? "",
    { includeUser: true }
  )
  const viewerId = session?.user?.id ?? null

  try {
    const page = await getExchangeMatchingOffersPage({
      perfumeId,
      discovery,
      search: searchQuery,
      viewerId,
      cursor,
      take,
    })
    return NextResponse.json({
      offers: page.offers,
      nextCursor: page.nextCursor,
      pageSize: page.pageSize,
      /** Echo for client cache keys — all query-affecting state. */
      queryKey: {
        perfumeId,
        cursor,
        take: page.pageSize,
        viewer: viewerId ? "1" : "0",
        filters: normalized.toString(),
      },
    })
  } catch (error) {
    console.error("[exchange/offers] failed", error)
    return NextResponse.json(
      { error: "Failed to load offers" },
      { status: 500 }
    )
  }
}
