import { describe, expect, it } from "vitest"

import { sanitizeText } from "./sanitize.server"

describe("sanitizeText", () => {
  it("preserves accented Latin letters", () => {
    expect(sanitizeText("Cédrat")).toBe("Cédrat")
    expect(sanitizeText("Crème")).toBe("Crème")
    expect(sanitizeText("Eau Fraîche")).toBe("Eau Fraîche")
  })

  it("preserves apostrophes in names", () => {
    expect(sanitizeText("L'Artisan")).toBe("L'Artisan")
  })

  it("strips angle brackets and javascript: protocol", () => {
    expect(sanitizeText("Foo<script>bar")).toBe("Fooscriptbar")
    expect(sanitizeText("javascript:alert(1)")).toBe("alert(1)")
  })

  it("strips control characters", () => {
    expect(sanitizeText("Hello\u0000World")).toBe("HelloWorld")
  })

  it("normalizes smart punctuation", () => {
    expect(sanitizeText("New\u2013York")).toBe("New-York")
    expect(sanitizeText("\u2018quoted\u2019")).toBe("'quoted'")
    expect(sanitizeText("\u2026")).toBe("...")
  })

  it("returns empty string for null/empty", () => {
    expect(sanitizeText(null)).toBe("")
    expect(sanitizeText("")).toBe("")
  })
})
