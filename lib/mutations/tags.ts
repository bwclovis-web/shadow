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

  const response = await fetch("/api/createTag", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag: tag.trim() }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.message || "Failed to create tag")
  }

  return {
    success: result.success === true,
    data: result.data ?? result,
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

