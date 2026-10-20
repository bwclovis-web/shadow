import { describe, expect, it } from "vitest"

import {
  DEFAULT_MY_SCENTS_LAYOUT,
  parseMyScentsLayout,
} from "@/utils/my-scents-params"

describe("parseMyScentsLayout", () => {
  it("defaults to grid", () => {
    expect(parseMyScentsLayout(null)).toBe(DEFAULT_MY_SCENTS_LAYOUT)
    expect(parseMyScentsLayout(undefined)).toBe("grid")
    expect(parseMyScentsLayout("")).toBe("grid")
    expect(parseMyScentsLayout("grid")).toBe("grid")
    expect(parseMyScentsLayout("bogus")).toBe("grid")
  })

  it("accepts list", () => {
    expect(parseMyScentsLayout("list")).toBe("list")
  })
})
