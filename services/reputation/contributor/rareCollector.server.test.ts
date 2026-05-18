import { describe, expect, it } from "vitest"

import { RARE_COLLECTOR_MAX_HOUSE_MEMBERS } from "./constants"
import { houseQualifiesAsNiche } from "./rareCollector.server"

describe("houseQualifiesAsNiche", () => {
  it("returns true when distinct collectors are below the threshold", () => {
    expect(houseQualifiesAsNiche(RARE_COLLECTOR_MAX_HOUSE_MEMBERS - 1)).toBe(true)
    expect(houseQualifiesAsNiche(0)).toBe(true)
  })

  it("returns false at or above the threshold", () => {
    expect(houseQualifiesAsNiche(RARE_COLLECTOR_MAX_HOUSE_MEMBERS)).toBe(false)
    expect(houseQualifiesAsNiche(100)).toBe(false)
  })
})
