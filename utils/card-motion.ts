/**
 * Shared fragrance-card image hover — Matches for you / LinkCard treatment.
 * Pair with a parent `group` class. Best inside `overflow-hidden`.
 */

/** Radial reveal + full grayscale → color (the visible “Matches” hover). */
const CARD_IMAGE_HOVER_MOTION =
  "mask-radial-at-center mask-radial-from-10% mask-radial-to-75% filter grayscale-100 transition-all duration-500 ease-in-out group-hover:grayscale-0 group-hover:mask-radial-from-30% group-hover:mask-radial-to-100% motion-reduce:transition-none"

/**
 * Grid / cover cards (`next/image` fill + object-cover).
 * Resting zoom + mask; hover colorizes and eases scale/mask open.
 */
export const CARD_IMAGE_HOVER_CLASS = [
  "object-cover object-center scale-150",
  CARD_IMAGE_HOVER_MOTION,
  "group-hover:scale-110",
  "motion-reduce:scale-100 motion-reduce:group-hover:scale-100",
].join(" ")

/** List-row thumbs — same grayscale/mask, gentler scale. */
export const CARD_THUMB_HOVER_CLASS = [
  "object-cover object-center",
  CARD_IMAGE_HOVER_MOTION,
  "group-hover:scale-105",
  "motion-reduce:group-hover:scale-100",
].join(" ")

/**
 * Color-preserving cover hover (Collection redesign and surfaces that must not
 * rest in grayscale). Scale only — no `grayscale-*` filters.
 */
export const CARD_IMAGE_COLOR_HOVER_CLASS = [
  "object-cover object-center",
  "transition-transform duration-500 ease-in-out group-hover:scale-105",
  "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
].join(" ")

/** Square LinkCard with a remote image (Matches for you, house perfume grids). */
export const LINK_CARD_IMAGE_CLASS = [
  "w-full h-full aspect-square object-fill object-center scale-150",
  CARD_IMAGE_HOVER_MOTION,
  "group-hover:scale-110",
].join(" ")

/** Square LinkCard fallback bottle / house placeholder. */
export const LINK_CARD_FALLBACK_IMAGE_CLASS = [
  "w-full h-full aspect-square object-fill scale-120",
  CARD_IMAGE_HOVER_MOTION,
  "group-hover:scale-100",
].join(" ")

export const CARD_STAGGER_DEFAULT = {
  stagger: 0.05,
  from: { opacity: 0, y: 18 },
  to: {
    opacity: 1,
    y: 0,
    duration: 0.45,
    ease: "power2.out",
    clearProps: "transform,opacity",
  },
} as const
