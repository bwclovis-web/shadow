import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys as houseQueryKeys } from "@/lib/queries/houses"
import { queryKeys } from "@/lib/queries/perfumes"
import { queryKeys as dataQualityQueryKeys } from "@/lib/queries/dataQuality"

export interface DeletePerfumeParams {
  perfumeId: string
}

export interface DeletePerfumeResponse {
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

const deletePerfume = async (params: DeletePerfumeParams): Promise<DeletePerfumeResponse> => {
  const { perfumeId } = params

  const response = await fetch(`/api/deletePerfume?id=${encodeURIComponent(perfumeId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCsrfHeader(),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.message || "Failed to delete perfume")
  }

  return {
    success: result.success === true,
  }
}

/**
 * Hook to delete a perfume with optimistic updates.
 *
 * @example
 * ```tsx
 * const deletePerfume = useDeletePerfume()
 * deletePerfume.mutate({ perfumeId: "123" })
 * ```
 */
export const useDeletePerfume = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePerfume,
    onMutate: async variables => {
      const { perfumeId } = variables

      // Cancel outgoing refetches
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.perfumes.all }),
        queryClient.cancelQueries({ queryKey: houseQueryKeys.houses.all }),
      ])

      // Snapshot previous values for rollback
      const previousPerfumes = queryClient.getQueryData(queryKeys.perfumes.all)

      // Optimistically remove perfume from cache
      queryClient.setQueryData(queryKeys.perfumes.all, (old: any) => {
        if (!old) return old

        // Handle different query structures
        if (Array.isArray(old)) {
          return old.filter((perfume: any) => perfume.id !== perfumeId)
        }
        if (old.perfumes && Array.isArray(old.perfumes)) {
          return {
            ...old,
            perfumes: old.perfumes.filter((perfume: any) => perfume.id !== perfumeId),
          }
        }

        return old
      })

      // Remove specific perfume detail
      queryClient.removeQueries({
        queryKey: queryKeys.perfumes.detail(perfumeId),
      })

      return { previousPerfumes }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousPerfumes) {
        queryClient.setQueryData(queryKeys.perfumes.all, context.previousPerfumes)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.perfumes.all }),
        queryClient.invalidateQueries({ queryKey: houseQueryKeys.houses.all }),
        queryClient.invalidateQueries({
          queryKey: dataQualityQueryKeys.dataQuality.all,
          refetchType: "active",
        }),
      ])
    },
  })
}

