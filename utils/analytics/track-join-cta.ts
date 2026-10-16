import { track } from "@vercel/analytics"

export type JoinCtaPlacement =
  | "nav-desktop"
  | "nav-mobile-menu"
  | "nav-mobile-bottom"
  | "follow"
  | "prompt"
  | "banner"
  | "membership"
  | "sign-in"
  | "subscribe"
  | "exchange-empty"

export const trackJoinCtaClick = (
  placement: JoinCtaPlacement,
  freeOpen: boolean
): void => {
  try {
    track("join_cta_click", { placement, state: freeOpen ? "free" : "paid" })
  } catch {
    // Analytics must never block navigation
  }
}
