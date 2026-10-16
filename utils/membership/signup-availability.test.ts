import { describe, expect, it } from "vitest"

import { MEMBERSHIP, SIGN_UP } from "@/constants/routes"

import { computeSignupAvailability, getJoinCta } from "./signup-availability"

describe("computeSignupAvailability", () => {
  it("is open with remaining spots below the limit", () => {
    expect(computeSignupAvailability(5, 100)).toEqual({
      freeOpen: true,
      spotsLeft: 95,
      limit: 100,
    })
  })

  it("leaves one spot when one below the limit", () => {
    expect(computeSignupAvailability(99, 100)).toEqual({
      freeOpen: true,
      spotsLeft: 1,
      limit: 100,
    })
  })

  it("closes at the limit", () => {
    expect(computeSignupAvailability(100, 100)).toEqual({
      freeOpen: false,
      spotsLeft: 0,
      limit: 100,
    })
  })

  it("never reports negative spots over the limit", () => {
    expect(computeSignupAvailability(140, 100)).toEqual({
      freeOpen: false,
      spotsLeft: 0,
      limit: 100,
    })
  })
})

describe("getJoinCta", () => {
  it("points to free sign-up while open", () => {
    expect(getJoinCta(true)).toEqual({
      href: SIGN_UP,
      labelKey: "ctaOpen",
      newHereKey: "newHereOpen",
      followKey: "followOpen",
    })
  })

  it("points to membership once closed", () => {
    expect(getJoinCta(false)).toEqual({
      href: MEMBERSHIP,
      labelKey: "ctaClosed",
      newHereKey: "newHereClosed",
      followKey: "followClosed",
    })
  })
})
