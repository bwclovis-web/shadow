import type { TraderReputationV1 } from "@/services/reputation/types"
import { REPUTATION_V1_VERSION } from "@/services/reputation/v1-constants"

export interface TraderFeedbackSummary {
  traderId: string
  averageRating: number | null
  totalReviews: number
  badgeEligible: boolean
}

function fallbackReputation(traderId: string): TraderReputationV1 {
  return {
    version: REPUTATION_V1_VERSION,
    traderId,
    score: null,
    insufficientDataReason: "noReviews",
    averageRating: null,
    totalReviews: 0,
    medianFirstReplyHours: null,
    replySampleCount: 0,
    badges: [],
    completedTradeCount: 0,
    tradeReliabilityPercent: null,
  }
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
  reputation: TraderReputationV1
  canLeaveFeedback: boolean
  eligibleTradeId: string | null
}

export interface TraderFeedbackQueryParams {
  traderId: string
  includeComments?: boolean
  viewerId?: string | null
  signal?: AbortSignal
}

export const queryKeys = {
  traderFeedback: {
    detail: (traderId: string, viewerId?: string | null) => ["traderFeedback", traderId, viewerId ?? null] as const,
  },
} as const

export async function getTraderFeedback(params: TraderFeedbackQueryParams): Promise<TraderFeedbackResponse> {
  const { traderId, includeComments = true, viewerId, signal } = params

  const searchParams = new URLSearchParams({
    traderId,
    includeComments: String(includeComments),
  })

  if (viewerId) {
    searchParams.append("viewerId", viewerId)
  }

  const response = await fetch(`/api/trader-feedback?${searchParams.toString()}`, {
    credentials: "include",
    signal,
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
    reputation: data.reputation ?? fallbackReputation(traderId),
    canLeaveFeedback: data.canLeaveFeedback ?? true,
    eligibleTradeId: data.eligibleTradeId ?? null,
  }
}

