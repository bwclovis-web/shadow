import { MEMBERSHIP, SIGN_UP } from "@/constants/routes"

export type SignupAvailability = {
  freeOpen: boolean
  spotsLeft: number
  limit: number
}

/** Fallback when availability cannot be loaded — show paid wording, never over-promise. */
export const CLOSED_SIGNUP_AVAILABILITY: SignupAvailability = {
  freeOpen: false,
  spotsLeft: 0,
  limit: 0,
}

export const computeSignupAvailability = (
  userCount: number,
  limit: number
): SignupAvailability => {
  const spotsLeft = Math.max(0, limit - userCount)
  return { freeOpen: spotsLeft > 0, spotsLeft, limit }
}

export type JoinCta = {
  href: string
  /** Key within the `join` translation namespace. */
  labelKey: "ctaOpen" | "ctaClosed"
  newHereKey: "newHereOpen" | "newHereClosed"
  followKey: "followOpen" | "followClosed"
}

export const getJoinCta = (freeOpen: boolean): JoinCta =>
  freeOpen
    ? {
        href: SIGN_UP,
        labelKey: "ctaOpen",
        newHereKey: "newHereOpen",
        followKey: "followOpen",
      }
    : {
        href: MEMBERSHIP,
        labelKey: "ctaClosed",
        newHereKey: "newHereClosed",
        followKey: "followClosed",
      }
