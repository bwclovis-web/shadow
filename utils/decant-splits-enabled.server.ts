/** When false, split APIs return 404 and UI hides group-split entry points. */
export const isDecantSplitsEnabled = (): boolean =>
  process.env.DECANT_SPLITS_ENABLED !== "false"
