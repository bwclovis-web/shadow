import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useCSRF } from "~/hooks/useCSRF"

export interface SubmitTraderFeedbackParams {
  traderId: string
  rating: number
  comment?: string
  tradeId?: string | null
  viewerId?: string | null
}

export interface DeleteTraderFeedbackParams {
  traderId: string
  viewerId?: string | null
}

export function useSubmitTraderFeedback() {
  const queryClient = useQueryClient()
  const { addToFormData, addToHeaders } = useCSRF()

  return useMutation({
    mutationFn: async (params: SubmitTraderFeedbackParams) => {
      const formData = new FormData()
      formData.append("_action", "submit")
      formData.append("traderId", params.traderId)
      formData.append("rating", String(params.rating))
      if (typeof params.comment === "string") {
        formData.append("comment", params.comment)
      }
      if (params.tradeId?.trim()) {
        formData.append("tradeId", params.tradeId.trim())
      }

      const response = await fetch("/api/trader-feedback", {
        method: "POST",
        body: addToFormData(formData),
        credentials: "include",
        headers: addToHeaders(),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to submit trader feedback")
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

export function useDeleteTraderFeedback() {
  const queryClient = useQueryClient()
  const { addToFormData, addToHeaders } = useCSRF()

  return useMutation({
    mutationFn: async (params: DeleteTraderFeedbackParams) => {
      const formData = new FormData()
      formData.append("_action", "remove")
      formData.append("traderId", params.traderId)

      const response = await fetch("/api/trader-feedback", {
        method: "POST",
        body: addToFormData(formData),
        credentials: "include",
        headers: addToHeaders(),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to delete trader feedback")
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

