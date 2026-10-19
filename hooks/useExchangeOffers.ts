"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  fetchExchangeOffersPage,
  type ExchangeOffersApiResponse,
} from "@/lib/queries/exchange-offers"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"

export type ExchangeOffersStatus = "idle" | "loading" | "success" | "error"

export type UseExchangeOffersOptions = {
  perfumeId: string | null
  filterQueryString: string
  /** When false, no fetch runs and state resets. */
  enabled: boolean
}

export const useExchangeOffers = ({
  perfumeId,
  filterQueryString,
  enabled,
}: UseExchangeOffersOptions) => {
  const [offers, setOffers] = useState<ExchangeOfferDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<ExchangeOffersStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestGen = useRef(0)

  const reset = useCallback(() => {
    requestGen.current += 1
    setOffers([])
    setNextCursor(null)
    setStatus("idle")
    setErrorMessage(null)
    setLoadingMore(false)
  }, [])

  const loadInitial = useCallback(async () => {
    if (!enabled || !perfumeId) {
      reset()
      return
    }
    const gen = ++requestGen.current
    setStatus("loading")
    setErrorMessage(null)
    setOffers([])
    setNextCursor(null)
    try {
      const page = await fetchExchangeOffersPage({
        perfumeId,
        filterQueryString,
      })
      if (gen !== requestGen.current) return
      setOffers(page.offers)
      setNextCursor(page.nextCursor)
      setStatus("success")
    } catch (error) {
      if (gen !== requestGen.current) return
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load offers"
      )
    }
  }, [enabled, perfumeId, filterQueryString, reset])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (!perfumeId || !nextCursor || loadingMore || status !== "success") return
    const gen = requestGen.current
    setLoadingMore(true)
    try {
      const page = await fetchExchangeOffersPage({
        perfumeId,
        filterQueryString,
        cursor: nextCursor,
      })
      if (gen !== requestGen.current) return
      setOffers(prev => {
        const seen = new Set(prev.map(o => o.id))
        const appended = page.offers.filter(o => !seen.has(o.id))
        return [...prev, ...appended]
      })
      setNextCursor(page.nextCursor)
    } catch (error) {
      if (gen !== requestGen.current) return
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load more offers"
      )
    } finally {
      if (gen === requestGen.current) setLoadingMore(false)
    }
  }, [
    perfumeId,
    nextCursor,
    loadingMore,
    status,
    filterQueryString,
  ])

  const removeOfferLocally = useCallback((offerId: string) => {
    setOffers(prev => prev.filter(o => o.id !== offerId))
  }, [])

  /** Re-check first pages for an offer still matching current filters. */
  const verifyOfferStillAvailable = useCallback(
    async (offerId: string): Promise<boolean> => {
      if (!perfumeId) return false
      let cursor: string | null = null
      for (let i = 0; i < 5; i++) {
        const page: ExchangeOffersApiResponse = await fetchExchangeOffersPage({
          perfumeId,
          filterQueryString,
          cursor,
        })
        if (page.offers.some(o => o.id === offerId)) return true
        if (!page.nextCursor) break
        cursor = page.nextCursor
      }
      return false
    },
    [perfumeId, filterQueryString]
  )

  return {
    offers,
    nextCursor,
    status,
    errorMessage,
    loadingMore,
    hasMore: Boolean(nextCursor),
    reload: loadInitial,
    loadMore,
    removeOfferLocally,
    verifyOfferStillAvailable,
    reset,
  }
}
