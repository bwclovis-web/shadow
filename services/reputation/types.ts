import { REPUTATION_V1_VERSION } from "./v1-constants"

export type ReputationBadgeId = "topReviewed" | "reliableTrader" | "fastResponder"

/** Serializable reputation DTO for API, RSC props, and exchange batch */
export interface TraderReputationV1 {
  version: typeof REPUTATION_V1_VERSION
  traderId: string
  /** 0–100 when enough review data; null otherwise */
  score: number | null
  /** When score is null */
  insufficientDataReason: "none" | "noReviews" | "tooFewReviews"
  averageRating: number | null
  totalReviews: number
  /** Median hours to first reply as trader; null if insufficient message pairs */
  medianFirstReplyHours: number | null
  replySampleCount: number
  badges: ReputationBadgeId[]
}
