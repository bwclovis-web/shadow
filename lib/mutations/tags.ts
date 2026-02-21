import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "~/lib/queries/tags"

export interface CreateTagParams {
  tag: string
}

export interface CreateTagResponse {
  success: boolean
  data?: any
  message?: string
  error?: string
}

/**
 * Create a tag mutation function.
 */
async function createTag(params: CreateTagParams): Promise<CreateTagResponse> {
  const { tag } = params

  if (!tag || !tag.trim()) {
    throw new Error("Tag name is required")
  }

  const response = await fetch(`/api/createTag?tag=${encodeURIComponent(tag.trim())}`, {
    method: "GET",
    credentials: "include",
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || "Failed to create tag")
  }

  const result = await response.json()

  // API returns array, so we'll handle that
  return {
    success: Array.isArray(result) ? result.length > 0 : !!result,
    data: Array.isArray(result) ? result[0] : result,
  }
}

/**
 * Hook to create a tag.
 * 
 * @example
 * ```tsx
 * const createTag = useCreateTag()
 * createTag.mutate({ tag: "floral" })
 * ```
 */
export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTag,
    onSuccess: (data, variables) => {
      const { tag } = variables

      // Invalidate tag queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.all,
      })

      // Invalidate specific tag query if it exists
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.byName(tag),
      })
    },
  })
}

