import type { RecommendationFeedbackAction } from "@prisma/client"

import { prisma } from "@/lib/db"
import { recordTasteEvent } from "@/models/taste-event.server"

export const submitRecommendationFeedback = async (params: {
  userId: string
  perfumeId: string
  action: RecommendationFeedbackAction
  source?: string | null
}) => {
  const feedback = await prisma.recommendationFeedback.upsert({
    where: {
      userId_perfumeId_action: {
        userId: params.userId,
        perfumeId: params.perfumeId,
        action: params.action,
      },
    },
    create: {
      userId: params.userId,
      perfumeId: params.perfumeId,
      action: params.action,
      source: params.source ?? null,
    },
    update: {
      source: params.source ?? null,
    },
  })

  const tasteMap: Partial<
    Record<
      RecommendationFeedbackAction,
      "dislike" | "skip_recommendation" | "owned" | "sample_outcome" | "rating"
    >
  > = {
    not_for_me: "dislike",
    already_own: "owned",
    sampled: "sample_outcome",
    more_like_this: "rating",
  }
  const eventType = tasteMap[params.action]
  if (eventType) {
    await recordTasteEvent({
      userId: params.userId,
      perfumeId: params.perfumeId,
      eventType,
      weight: params.action === "more_like_this" ? 1.5 : 1,
      metadata: { from: "recommendation_feedback", action: params.action },
    })
  }

  return feedback
}

export const getExcludedPerfumeIdsFromFeedback = async (
  userId: string
): Promise<string[]> => {
  const rows = await prisma.recommendationFeedback.findMany({
    where: {
      userId,
      action: { in: ["not_for_me", "already_own"] },
    },
    select: { perfumeId: true },
  })
  return [...new Set(rows.map(r => r.perfumeId))]
}
