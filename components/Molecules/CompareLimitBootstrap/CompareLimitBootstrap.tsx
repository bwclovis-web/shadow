"use client"

import { useEffect } from "react"

import { getCompareMaxForEntitlements } from "@/constants/compare"
import { useCompareStore } from "@/hooks/compareStore"
import { apiFetch } from "@/lib/api-client"

/**
 * Syncs compare tray max items with Premium `unlimited_comparisons` entitlement.
 */
export const CompareLimitBootstrap = () => {
  const setMaxItems = useCompareStore(s => s.setMaxItems)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const data = await apiFetch<{
          entitlements?: string[]
        }>("/api/membership")
        if (cancelled) return
        setMaxItems(getCompareMaxForEntitlements(data.entitlements ?? []))
      } catch {
        if (!cancelled) setMaxItems(getCompareMaxForEntitlements([]))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [setMaxItems])

  return null
}
