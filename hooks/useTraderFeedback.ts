import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import {
  type DeleteTraderFeedbackParams,
  type SubmitTraderFeedbackParams,
  useDeleteTraderFeedback,
  useSubmitTraderFeedback,
} from "~/lib/mutations/traderFeedback"
import type { TraderFeedbackSort } from "@/models/traderFeedback.server"
import {
  getTraderFeedback,
  queryKeys,
  type TraderFeedbackResponse,
} from "~/lib/queries/traderFeedback"

type SubmitParams = SubmitTraderFeedbackParams & {
  viewerId?: string | null
}

const STALE_TIME_MS = 60 * 1000

export const useTraderFeedback = (
  traderId: string,
  viewerId?: string | null,
  initialData?: TraderFeedbackResponse,
  sort: TraderFeedbackSort = "top"
) =>
  useQuery({
    queryKey: queryKeys.traderFeedback.detail(traderId, viewerId, sort),
    queryFn: ({ signal }) =>
      getTraderFeedback({
        traderId,
        viewerId,
        includeComments: true,
        sort,
        signal,
      }),
    enabled: !!traderId,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  })

export const useTraderFeedbackMutations = () => {
  const submitMutation = useSubmitTraderFeedback()
  const deleteMutation = useDeleteTraderFeedback()

  const submitFeedback = useCallback(
    ({ comment, ...rest }: SubmitParams) => {
      submitMutation.mutate({
        ...rest,
        comment: comment?.trim(),
      })
    },
    [submitMutation]
  )

  const deleteFeedback = useCallback(
    (params: DeleteTraderFeedbackParams) => {
      deleteMutation.mutate(params)
    },
    [deleteMutation]
  )

  return {
    submitFeedback,
    deleteFeedback,
    submitMutation,
    deleteMutation,
    isMutating: submitMutation.isPending || deleteMutation.isPending,
  }
}

