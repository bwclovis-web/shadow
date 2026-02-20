import { useQuery } from "@tanstack/react-query"

import {
  getUserAlerts,
  queryKeys,
  type UserAlertsResponse,
} from "~/lib/queries/user"
import { getBackgroundRefetchConfig } from "~/lib/utils/backgroundRefetch"

/**
 * Hook to fetch user alerts with background refetching.
 * 
 * Uses TanStack Query with automatic background refetching every 30 seconds
 * to keep alerts up-to-date. Implements stale-while-revalidate pattern.
 * 
 * @param userId - User ID to fetch alerts for
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns Query result with alerts data, unread count, and loading/error states
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUserAlerts(userId)
 * const alerts = data?.alerts || []
 * const unreadCount = data?.unreadCount || 0
 * ```
 */
export function useUserAlerts(userId: string, enabled: boolean = true) {
  const activeStrategy = getBackgroundRefetchConfig("active")

  return useQuery<UserAlertsResponse>({
    queryKey: queryKeys.user.alerts(userId),
    queryFn: () => getUserAlerts(userId),
    enabled: enabled && !!userId,
    // Background refetching configuration
    refetchInterval: activeStrategy.refetchInterval,
    refetchOnWindowFocus: activeStrategy.refetchOnWindowFocus,
    refetchOnReconnect: activeStrategy.refetchOnReconnect,
    staleTime: activeStrategy.staleTime,
    // Stale-while-revalidate: show cached data while fetching fresh data
    placeholderData: previousData => previousData,
  })
}

