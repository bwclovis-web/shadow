/** Max perfumes in compare tray for free users. */
export const COMPARE_MAX_ITEMS_FREE = 3

/** Max perfumes for Premium/Collector (`unlimited_comparisons`). */
export const COMPARE_MAX_ITEMS_PREMIUM = 8

/**
 * Absolute ceiling used when entitlement is unknown (client bootstrap before fetch).
 * Prefer `getCompareMaxForEntitlements` / store `maxItems` at runtime.
 */
export const COMPARE_MAX_ITEMS = COMPARE_MAX_ITEMS_PREMIUM

/** Persist key in localStorage; stable for CF-003 URL sync. */
export const COMPARE_STORAGE_KEY = "shadows-compare-tray"

/** Synced to `document.documentElement` by `CompareTray`; read in `globals.css` and layout helpers. */
export const COMPARE_TRAY_PAD_VAR = "--compare-tray-pad"

export const getCompareMaxForEntitlements = (
  entitlements: readonly string[] | undefined | null
): number =>
  entitlements?.includes("unlimited_comparisons")
    ? COMPARE_MAX_ITEMS_PREMIUM
    : COMPARE_MAX_ITEMS_FREE
