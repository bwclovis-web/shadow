import { useCallback, useEffect, useState } from "react"

import type { PourableMlBudgetForClient } from "@/types/decant-split"

type BudgetFetchState = {
  budget: PourableMlBudgetForClient | null
  loading: boolean
  error: boolean
}

const initialState: BudgetFetchState = {
  budget: null,
  loading: true,
  error: false,
}

export const usePourableMlBudget = (perfumeId: string | null | undefined) => {
  const [state, setState] = useState<BudgetFetchState>(initialState)

  const refresh = useCallback(async (): Promise<{
    budget: PourableMlBudgetForClient | null
    error: boolean
  }> => {
    if (!perfumeId) {
      setState({ budget: null, loading: false, error: true })
      return { budget: null, error: true }
    }

    setState(prev => ({ ...prev, loading: true, error: false }))
    try {
      const res = await fetch(
        `/api/user-perfumes/budget?perfumeId=${encodeURIComponent(perfumeId)}`,
        { credentials: "include" }
      )
      const data = (await res.json().catch(() => null)) as {
        success?: boolean
        budget?: PourableMlBudgetForClient
      } | null

      if (!res.ok || !data?.success || !data.budget) {
        setState({ budget: null, loading: false, error: true })
        return { budget: null, error: true }
      }

      setState({ budget: data.budget, loading: false, error: false })
      return { budget: data.budget, error: false }
    } catch {
      setState({ budget: null, loading: false, error: true })
      return { budget: null, error: true }
    }
  }, [perfumeId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    budget: state.budget,
    loading: state.loading,
    error: state.error,
    refresh,
  }
}
