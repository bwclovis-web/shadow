import { describe, expect, it } from "vitest"

import { brandPageTitle } from "./metadata"

describe("brandPageTitle", () => {
  it("appends the site brand when missing", () => {
    expect(brandPageTitle("Sign In")).toBe("Sign In | perfumer's hollow")
    expect(brandPageTitle("Chanel No. 5 — Chanel")).toBe(
      "Chanel No. 5 — Chanel | perfumer's hollow"
    )
  })

  it("does not double-brand", () => {
    expect(brandPageTitle("perfumer's hollow")).toBe("perfumer's hollow")
    expect(brandPageTitle("The Archive | perfumer's hollow")).toBe(
      "The Archive | perfumer's hollow"
    )
  })
})
