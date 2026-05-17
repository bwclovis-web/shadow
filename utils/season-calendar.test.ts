import { describe, expect, it } from "vitest"

import { getCurrentSeasonKey } from "./season-calendar"

describe("getCurrentSeasonKey", () => {
  it("maps months to calendar seasons", () => {
    const d = (year: number, month: number, day = 15) =>
      new Date(year, month - 1, day)

    expect(getCurrentSeasonKey(d(2026, 1))).toBe("winter")
    expect(getCurrentSeasonKey(d(2026, 2))).toBe("winter")
    expect(getCurrentSeasonKey(d(2026, 3))).toBe("spring")
    expect(getCurrentSeasonKey(d(2026, 5))).toBe("spring")
    expect(getCurrentSeasonKey(d(2026, 6))).toBe("summer")
    expect(getCurrentSeasonKey(d(2026, 8))).toBe("summer")
    expect(getCurrentSeasonKey(d(2026, 9))).toBe("fall")
    expect(getCurrentSeasonKey(d(2026, 11))).toBe("fall")
    expect(getCurrentSeasonKey(d(2026, 12))).toBe("winter")
  })
})
