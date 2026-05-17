/**
 * When false, feedback may be submitted without a completed trade (legacy v1 open mode).
 * Default: require a completed trade between reviewer and trader (IMP-122).
 */
export const traderFeedbackRequiresCompletedTrade = (): boolean =>
  process.env.TRADER_FEEDBACK_REQUIRES_COMPLETED_TRADE !== "false"
