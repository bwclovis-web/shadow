import type { ReputationBadgeId, TraderReputationV1 } from "./types"
import {
  BADGE_RELIABLE_MIN_AVG,
  BADGE_RELIABLE_MIN_REVIEWS,
  BADGE_TOP_REVIEWED_MIN_AVG,
  BADGE_TOP_REVIEWED_MIN_REVIEWS,
  FAST_RESPONDER_MAX_MEDIAN_HOURS,
  FAST_RESPONDER_MIN_SAMPLES,
  MIN_REVIEWS_FOR_SCORE,
  MIN_REVIEWS_FULL_CONFIDENCE,
  REPUTATION_V1_VERSION,
  SCORE_FEEDBACK_WEIGHT,
  SCORE_RESPONSE_WEIGHT,
} from "./v1-constants"

export interface ReputationFeedbackInput {
  traderId: string
  averageRating: number | null
  totalReviews: number
}

export interface ReputationMessageStatsInput {
  medianFirstReplyHours: number | null
  replySampleCount: number
}

function responseScoreFromMedianHours(medianHours: number): number {
  if (medianHours <= 6) return 100
  if (medianHours <= 12) return 95
  if (medianHours <= 24) return 85
  if (medianHours <= 48) return 70
  if (medianHours <= 72) return 50
  return 35
}

function computeFeedbackScore(averageRating: number, totalReviews: number): number {
  const raw = ((averageRating - 1) / 4) * 100
  const confidenceWeight =
    0.5 + 0.5 * Math.min(1, totalReviews / MIN_REVIEWS_FULL_CONFIDENCE)
  return raw * confidenceWeight
}

function collectBadges(
  averageRating: number | null,
  totalReviews: number,
  medianFirstReplyHours: number | null,
  replySampleCount: number
): ReputationBadgeId[] {
  const badges: ReputationBadgeId[] = []
  if (
    averageRating !== null &&
    totalReviews >= BADGE_TOP_REVIEWED_MIN_REVIEWS &&
    averageRating >= BADGE_TOP_REVIEWED_MIN_AVG
  ) {
    badges.push("topReviewed")
  }
  if (
    averageRating !== null &&
    totalReviews >= BADGE_RELIABLE_MIN_REVIEWS &&
    averageRating >= BADGE_RELIABLE_MIN_AVG
  ) {
    badges.push("reliableTrader")
  }
  if (
    replySampleCount >= FAST_RESPONDER_MIN_SAMPLES &&
    medianFirstReplyHours !== null &&
    medianFirstReplyHours <= FAST_RESPONDER_MAX_MEDIAN_HOURS
  ) {
    badges.push("fastResponder")
  }
  return badges
}

/**
 * Pure v1 reputation from feedback summary + pre-computed message reply stats.
 */
export function computeTraderReputationV1(input: {
  feedback: ReputationFeedbackInput
  messageStats: ReputationMessageStatsInput
}): TraderReputationV1 {
  const { traderId, averageRating, totalReviews } = input.feedback
  const { medianFirstReplyHours, replySampleCount } = input.messageStats

  let score: number | null = null
  let insufficientDataReason: TraderReputationV1["insufficientDataReason"] = "none"

  if (totalReviews <= 0) {
    insufficientDataReason = "noReviews"
  } else if (totalReviews < MIN_REVIEWS_FOR_SCORE || averageRating === null) {
    insufficientDataReason = "tooFewReviews"
  } else {
    const feedbackScore = computeFeedbackScore(averageRating, totalReviews)
    const useResponse =
      replySampleCount >= FAST_RESPONDER_MIN_SAMPLES &&
      medianFirstReplyHours !== null
    const responseScore = useResponse
      ? responseScoreFromMedianHours(medianFirstReplyHours)
      : null
    const combined =
      responseScore !== null
        ? SCORE_FEEDBACK_WEIGHT * feedbackScore +
          SCORE_RESPONSE_WEIGHT * responseScore
        : feedbackScore
    score = Math.round(Math.min(100, Math.max(0, combined)))
  }

  const badges = collectBadges(
    averageRating,
    totalReviews,
    medianFirstReplyHours,
    replySampleCount
  )

  return {
    version: REPUTATION_V1_VERSION,
    traderId,
    score,
    insufficientDataReason,
    averageRating,
    totalReviews,
    medianFirstReplyHours,
    replySampleCount,
    badges,
  }
}
