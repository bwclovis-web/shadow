import { describe, expect, it } from "vitest"

import { normalizeR2ObjectKeyToWebp } from "@/lib/r2-webp"

describe("normalizeR2ObjectKeyToWebp", () => {
  it("replaces image extensions with webp", () => {
    expect(normalizeR2ObjectKeyToWebp("perfumes/abc.jpg")).toBe("perfumes/abc.webp")
    expect(normalizeR2ObjectKeyToWebp("houses/x.PNG")).toBe("houses/x.webp")
    expect(normalizeR2ObjectKeyToWebp("/avatars/u/id.jpeg")).toBe("avatars/u/id.webp")
  })

  it("appends webp when there is no extension", () => {
    expect(normalizeR2ObjectKeyToWebp("listings/u/raw")).toBe("listings/u/raw.webp")
  })

  it("keeps already-webp keys", () => {
    expect(normalizeR2ObjectKeyToWebp("reports/u/a.webp")).toBe("reports/u/a.webp")
  })
})
