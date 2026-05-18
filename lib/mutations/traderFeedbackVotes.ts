import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { HelpfulnessVoteValue } from "@/models/traderFeedbackHelpfulness.server"
import { useCSRF } from "~/hooks/useCSRF"

export interface VoteTraderFeedbackHelpfulnessParams {
  feedbackId: string
  value: HelpfulnessVoteValue | null
  traderId: string
  viewerId?: string | null
}

export const useVoteTraderFeedbackHelpfulness = () => {
  const queryClient = useQueryClient()
  const { addToFormData, addToHeaders } = useCSRF()

  return useMutation({
    mutationFn: async (params: VoteTraderFeedbackHelpfulnessParams) => {
      const formData = new FormData()
      formData.append("feedbackId", params.feedbackId)
      if (params.value) {
        formData.append("value", params.value)
      }

      const response = await fetch("/api/trader-feedback-votes", {
        method: "POST",
        body: addToFormData(formData),
        credentials: "include",
        headers: addToHeaders(),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Failed to save feedback vote"
        )
      }

      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["traderFeedback", variables.traderId],
        exact: false,
      })
    },
  })
}
