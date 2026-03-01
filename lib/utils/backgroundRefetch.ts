/**
 * Background refetch configuration for TanStack Query.
 */

export type BackgroundRefetchStrategy = "active" | "passive" | "disabled"

export interface BackgroundRefetchConfig {
  refetchInterval: number | false
  refetchOnWindowFocus: boolean
  refetchOnReconnect: boolean
  staleTime: number
}

const configs: Record<BackgroundRefetchStrategy, BackgroundRefetchConfig> = {
  active: {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 10_000,
  },
  passive: {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  },
  disabled: {
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000,
  },
}

export function getBackgroundRefetchConfig(
  strategy: BackgroundRefetchStrategy = "active"
): BackgroundRefetchConfig {
  return configs[strategy] ?? configs.active
}
