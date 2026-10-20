import { useCallback, useEffect, useRef, useState } from "react"

import type { PourableMlBudgetForClient } from "@/types/decant-split"

type BudgetFetchState = {
  budget: PourableMlBudgetForClient | null
  loading: boolean
  error: boolean
  /** Identifies which perfume/source the current budget belongs to. */
  scopeKey: string | null
}

const initialState: BudgetFetchState = {
  budget: null,
  loading: true,
  error: false,
  scopeKey: null,
}

/**
 * Fetch pourable budget for the group-split wizard via the flag-gated
 * `/api/decant-splits/budget` route. Refetches when perfume or source changes;
 * callers should treat a mismatched scopeKey as stale.
 */
export const useDecantSplitBudget = (
  perfumeId: string | null | undefined,
  sourceUserPerfumeId?: string | null
) => {
  const scopeKey = perfumeId
    ? `${perfumeId}:${sourceUserPerfumeId ?? ""}`
    : null
  const [state, setState] = useState<BudgetFetchState>(initialState)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async (): Promise<{
    budget: PourableMlBudgetForClient | null
    error: boolean
    scopeKey: string | null
  }> => {
    if (!perfumeId || !scopeKey) {
      setState({ budget: null, loading: false, error: true, scopeKey: null })
      return { budget: null, error: true, scopeKey: null }
    }

    const requestId = ++requestIdRef.current
    setState(prev => ({
      ...prev,
      loading: true,
      error: false,
      scopeKey,
    }))

    try {
      const res = await fetch(
        `/api/decant-splits/budget?perfumeId=${encodeURIComponent(perfumeId)}`,
        { credentials: "include" }
      )
      const data = (await res.json().catch(() => null)) as {
        success?: boolean
        budget?: PourableMlBudgetForClient
      } | null

      if (requestId !== requestIdRef.current) {
        return { budget: null, error: true, scopeKey }
      }

      if (!res.ok || !data?.success || !data.budget) {
        setState({ budget: null, loading: false, error: true, scopeKey })
        return { budget: null, error: true, scopeKey }
      }

      setState({
        budget: data.budget,
        loading: false,
        error: false,
        scopeKey,
      })
      return { budget: data.budget, error: false, scopeKey }
    } catch {
      if (requestId !== requestIdRef.current) {
        return { budget: null, error: true, scopeKey }
      }
      setState({ budget: null, loading: false, error: true, scopeKey })
      return { budget: null, error: true, scopeKey }
    }
  }, [perfumeId, scopeKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isStale = state.scopeKey != null && state.scopeKey !== scopeKey

  return {
    budget: isStale ? null : state.budget,
    loading: isStale || state.loading,
    error: isStale ? false : state.error,
    scopeKey,
    isStale,
    refresh,
  }
}
