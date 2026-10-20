import { describe, expect, it } from "vitest"

import {
  classifyDestashEditFailure,
  isListingPresentInEditorScope,
  nextEditSnapshotTransition,
  shouldConfirmDiscard,
} from "@/lib/destash-editor-interactions"

describe("shouldConfirmDiscard", () => {
  it("requires confirm only when dirty", () => {
    expect(shouldConfirmDiscard(true)).toBe(true)
    expect(shouldConfirmDiscard(false)).toBe(false)
  })
})

describe("nextEditSnapshotTransition", () => {
  it("loads when opening a listing", () => {
    expect(nextEditSnapshotTransition(null, "a")).toBe("load")
  })

  it("keeps draft when the same listing is re-passed", () => {
    expect(nextEditSnapshotTransition("a", "a")).toBe("keep")
  })

  it("loads when switching listings", () => {
    expect(nextEditSnapshotTransition("a", "b")).toBe("load")
  })

  it("clears when the editor closes", () => {
    expect(nextEditSnapshotTransition("a", null)).toBe("clear")
  })
})

describe("isListingPresentInEditorScope", () => {
  it("finds active or paused rows", () => {
    expect(isListingPresentInEditorScope("x", ["x"], [])).toBe(true)
    expect(isListingPresentInEditorScope("y", [], ["y"])).toBe(true)
    expect(isListingPresentInEditorScope("z", ["a"], ["b"])).toBe(false)
  })
})

describe("classifyDestashEditFailure", () => {
  it("maps auth and not-found responses", () => {
    expect(
      classifyDestashEditFailure({
        status: 403,
        success: false,
        ok: false,
        error: "Forbidden",
      })
    ).toBe("forbidden")
    expect(
      classifyDestashEditFailure({
        status: 404,
        success: false,
        ok: false,
        error: "Listing not found",
      })
    ).toBe("gone")
    expect(
      classifyDestashEditFailure({
        status: 200,
        success: false,
        ok: true,
        error: "Perfume not found in your collection",
      })
    ).toBe("gone")
    expect(
      classifyDestashEditFailure({
        status: 400,
        success: false,
        ok: false,
        error: "Amount is required",
      })
    ).toBe("generic")
  })
})
