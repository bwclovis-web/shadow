/**
 * Must stay in sync with docs/reputation-v1-spec.md
 */
export const REPUTATION_V1_VERSION = "1.0" as const

/** Minimum peer reviews before a numeric reputation score is shown */
export const MIN_REVIEWS_FOR_SCORE = 3

/** Reviews at which feedback confidence weight reaches 1.0 */
export const MIN_REVIEWS_FULL_CONFIDENCE = 10

export const SCORE_FEEDBACK_WEIGHT = 0.75
export const SCORE_RESPONSE_WEIGHT = 0.25

export const BADGE_TOP_REVIEWED_MIN_REVIEWS = 5
export const BADGE_TOP_REVIEWED_MIN_AVG = 4.5

export const BADGE_RELIABLE_MIN_REVIEWS = 10
export const BADGE_RELIABLE_MIN_AVG = 4.6

/** Minimum measured reply intervals (from last N conversation partners) */
export const FAST_RESPONDER_MIN_SAMPLES = 3
/** Median first-reply must be under this many hours (IMP-121) */
export const FAST_RESPONDER_MAX_MEDIAN_HOURS = 24
/** Only the most recent conversation partners are considered (IMP-121) */
export const FAST_RESPONDER_MAX_THREADS = 10

/** Minimum completed + self-cancelled trades before showing reliability % */
export const MIN_TRADES_FOR_RELIABILITY_PERCENT = 1
