export interface TraderFeedbackSummary {
  traderId: string
  averageRating: number | null
  totalReviews: number
  badgeEligible: boolean
}

export interface TraderFeedbackComment {
  id: string
  traderId: string
  reviewerId: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
  reviewer: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
  }
}

export interface TraderFeedbackViewerEntry {
  traderId: string
  reviewerId: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface TraderFeedbackResponse {
  summary: TraderFeedbackSummary
  comments: TraderFeedbackComment[]
  viewerFeedback: TraderFeedbackViewerEntry | null
}

export interface TraderFeedbackQueryParams {
  traderId: string
  includeComments?: boolean
  viewerId?: string | null
}

export const queryKeys = {
  traderFeedback: {
    detail: (traderId: string, viewerId?: string | null) => ["traderFeedback", traderId, viewerId ?? null] as const,
  },
} as const

export async function getTraderFeedback(params: TraderFeedbackQueryParams): Promise<TraderFeedbackResponse> {
  const { traderId, includeComments = true, viewerId } = params

  const searchParams = new URLSearchParams({
    traderId,
    includeComments: includeComments ? "true" : "false",
  })

  if (viewerId) {
    searchParams.append("viewerId", viewerId)
  }

  const response = await fetch(`/api/trader-feedback?${searchParams.toString()}`, {
    credentials: "include",
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ||
        errorData.message ||
        `Failed to fetch trader feedback: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch trader feedback")
  }

  return {
    summary: data.summary ?? {
      traderId,
      averageRating: null,
      totalReviews: 0,
      badgeEligible: false,
    },
    comments: data.comments ?? [],
    viewerFeedback: data.viewerFeedback ?? null,
  }
}

