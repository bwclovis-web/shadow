/** Client-safe feature flag (defaults on). */
export const isDecantSplitsEnabledClient = (): boolean =>
  process.env.NEXT_PUBLIC_DECANT_SPLITS_ENABLED !== "false"
