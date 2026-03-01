import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queries/houses"
import { queryKeys as perfumeQueryKeys } from "@/lib/queries/perfumes"
import { queryKeys as dataQualityQueryKeys } from "@/lib/queries/dataQuality"

export interface DeleteHouseParams {
  houseId: string
}

export interface DeleteHouseResponse {
  success: boolean
  message?: string
  error?: string
}

const getCsrfHeader = (): HeadersInit => {
  if (typeof document === "undefined") return {}
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("_csrf="))
  const token = cookie ? cookie.split("=")[1]?.trim() : null
  return token ? { "x-csrf-token": token } : {}
}

/**
 * Delete a house mutation function.
 */
const deleteHouse = async (
  params: DeleteHouseParams
): Promise<DeleteHouseResponse> => {
  const { houseId } = params

  const response = await fetch(`/api/deleteHouse?id=${encodeURIComponent(houseId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCsrfHeader(),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.message || "Failed to delete house")
  }

  return {
    success: result.success === true,
  }
}

/**
 * Hook to delete a house with optimistic updates.
 *
 * @example
 * ```tsx
 * const deleteHouse = useDeleteHouse()
 * deleteHouse.mutate({ houseId: "123" })
 * ```
 */
export const useDeleteHouse = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteHouse,
    onMutate: async variables => {
      const { houseId } = variables

      // Cancel outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.houses.all }),
        queryClient.cancelQueries({ queryKey: perfumeQueryKeys.perfumes.all }),
      ])

      // Snapshot previous values for rollback
      const previousHouses = queryClient.getQueryData(queryKeys.houses.all)

      // Optimistically remove house from cache
      queryClient.setQueryData(queryKeys.houses.all, (old: any) => {
        if (!old) return old

        // Handle different query structures
        if (Array.isArray(old)) {
          return old.filter((house: any) => house.id !== houseId)
        }
        if (old.houses && Array.isArray(old.houses)) {
          return {
            ...old,
            houses: old.houses.filter((house: any) => house.id !== houseId),
          }
        }

        return old
      })

      return { previousHouses }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousHouses) {
        queryClient.setQueryData(queryKeys.houses.all, context.previousHouses)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.houses.all }),
        queryClient.invalidateQueries({
          queryKey: perfumeQueryKeys.perfumes.all,
        }),
        queryClient.invalidateQueries({
          queryKey: dataQualityQueryKeys.dataQuality.all,
          refetchType: "active",
        }),
      ])
    },
  })
}

