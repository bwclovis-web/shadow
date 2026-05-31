import { describe, expect, it } from "vitest"

import { deriveMaterialSlugFromNoteName } from "./rules"

describe("deriveMaterialSlugFromNoteName", () => {
  it("maps regional bergamot variants to bergamot", () => {
    expect(deriveMaterialSlugFromNoteName("italian bergamot")).toBe("bergamot")
    expect(deriveMaterialSlugFromNoteName("Sicilian Bergamot")).toBe("bergamot")
  })

  it("maps patchouli variants to patchouli", () => {
    expect(deriveMaterialSlugFromNoteName("east indian patchouli")).toBe("patchouli")
    expect(deriveMaterialSlugFromNoteName("indonesian patchouli")).toBe("patchouli")
  })

  it("maps marketing amber variants to amber but not ambergris", () => {
    expect(deriveMaterialSlugFromNoteName("indian amber")).toBe("amber")
    expect(deriveMaterialSlugFromNoteName("golden amber")).toBe("amber")
    expect(deriveMaterialSlugFromNoteName("ambergris")).toBe("ambergris")
    expect(deriveMaterialSlugFromNoteName("amber")).toBe("amber")
  })

  it("does not map white musk to musk", () => {
    expect(deriveMaterialSlugFromNoteName("white musk")).toBeNull()
    expect(deriveMaterialSlugFromNoteName("musk")).toBe("musk")
  })

  it("skips protected multi-word notes", () => {
    expect(deriveMaterialSlugFromNoteName("italian white clove")).toBeNull()
  })

  it("passes through exact material names", () => {
    expect(deriveMaterialSlugFromNoteName("vanilla")).toBe("vanilla")
    expect(deriveMaterialSlugFromNoteName("madagascar vanilla")).toBe("vanilla")
  })
})
