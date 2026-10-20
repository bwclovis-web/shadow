import { apiFetch, getCSRFFromCookie, getCsrfHeaders } from "@/lib/api-client"

export type SamplingQueueAddResponse = {
  success: boolean
  item?: {
    id: string
    perfumeId: string
    status: string
  }
  error?: string
}

/** Add a perfume to the signed-in user's Try next queue. */
export const postAddToSamplingQueue = async (
  perfumeId: string,
  notes?: string | null
): Promise<SamplingQueueAddResponse> => {
  const csrf = getCSRFFromCookie()
  return apiFetch<SamplingQueueAddResponse>("/api/sampling-queue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getCsrfHeaders(),
    },
    body: JSON.stringify({
      intent: "add",
      perfumeId,
      ...(notes != null ? { notes } : {}),
      ...(csrf ? { _csrf: csrf } : {}),
    }),
  })
}
