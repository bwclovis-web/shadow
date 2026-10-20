/**
 * Shared fragrance-card motion classes (Archive / Exchange / Seeking / My Scents).
 * Pair image hover with a parent `group` class.
 */
export const CARD_IMAGE_HOVER_CLASS =
  "object-cover grayscale-[0.6] transition-[filter,transform] duration-500 ease-out group-hover:scale-105 group-hover:grayscale-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"

/** Slightly softer hover for small thumbs (list rows). */
export const CARD_THUMB_HOVER_CLASS =
  "object-cover grayscale-[0.5] transition-[filter,transform] duration-500 ease-out group-hover:scale-105 group-hover:grayscale-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"

export const CARD_STAGGER_DEFAULT = {
  stagger: 0.035,
  from: { opacity: 0, y: 12 },
  to: {
    opacity: 1,
    y: 0,
    duration: 0.4,
    ease: "power2.out",
    clearProps: "transform,opacity",
  },
} as const
