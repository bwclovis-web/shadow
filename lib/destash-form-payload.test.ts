import { describe, expect, it } from "vitest"

import {
  appendDestashListingFields,
  buildCleanCreateUserPerfume,
  CLEAN_DESTASH_LISTING_FIELDS,
  mergeListingIntoCollection,
  parseDestashApiResponse,
  toDestashListingSubmitPayload,
} from "@/lib/destash-form-payload"
import type { UserPerfumeI } from "@/types"

describe("toDestashListingSubmitPayload / appendDestashListingFields", () => {
  it("sends empty tradePrice and metadata so the server can clear them", () => {
    const payload = toDestashListingSubmitPayload({
      amount: "10",
      price: "",
      tradePreference: "both",
      tradeOnly: false,
      images: [],
      condition: null,
      decantFormat: null,
    })
    expect(payload.tradePrice).toBe("")
    expect(payload.condition).toBe("")
    expect(payload.decantFormat).toBe("")

    const formData = new FormData()
    appendDestashListingFields(formData, payload)
    expect(formData.has("tradePrice")).toBe(true)
    expect(formData.get("tradePrice")).toBe("")
    expect(formData.get("condition")).toBe("")
    expect(formData.get("decantFormat")).toBe("")
    expect(formData.get("images")).toBe("[]")
    expect(formData.get("tradePreference")).toBe("both")
  })

  it("preserves set price and metadata values", () => {
    const payload = toDestashListingSubmitPayload({
      amount: "5",
      price: "12.50",
      tradePreference: "cash",
      tradeOnly: false,
      images: ["https://example.com/a.jpg"],
      condition: "sealed",
      decantFormat: "vial",
    })
    const formData = new FormData()
    appendDestashListingFields(formData, payload)
    expect(formData.get("tradePrice")).toBe("12.50")
    expect(formData.get("condition")).toBe("sealed")
    expect(formData.get("decantFormat")).toBe("vial")
  })
})

describe("buildCleanCreateUserPerfume", () => {
  it("does not copy another listing’s photos, price, or metadata", () => {
    const draft = buildCleanCreateUserPerfume({
      perfumeId: "p1",
      perfumeName: "Test",
      ownedAmountHint: "100",
    })
    expect(draft.tradePrice).toBeNull()
    expect(draft.images).toEqual([])
    expect(draft.condition).toBeNull()
    expect(draft.decantFormat).toBeNull()
    expect(draft.tradePreference).toBe(
      CLEAN_DESTASH_LISTING_FIELDS.tradePreference
    )
    expect(draft.available).toBe("0")
    expect(draft.amount).toBe("100")
  })
})

describe("parseDestashApiResponse", () => {
  it("handles success, HTTP error bodies, and malformed JSON", async () => {
    const ok = await parseDestashApiResponse(
      new Response(JSON.stringify({ success: true, userPerfume: { id: "1" } }), {
        status: 200,
      })
    )
    expect(ok.success).toBe(true)
    expect(ok.userPerfume?.id).toBe("1")

    const fail = await parseDestashApiResponse(
      new Response(JSON.stringify({ success: false, errorCode: "exceedsAvailable" }), {
        status: 400,
      })
    )
    expect(fail.success).toBe(false)
    expect(fail.errorCode).toBe("exceedsAvailable")
    expect(fail.ok).toBe(false)

    const malformed = await parseDestashApiResponse(
      new Response("not-json", { status: 500 })
    )
    expect(malformed.malformed).toBe(true)
    expect(malformed.success).toBe(false)
  })
})

describe("mergeListingIntoCollection", () => {
  it("updates an existing row without dropping siblings", () => {
    const prev = [
      { id: "a", perfumeId: "p", available: "10" },
      { id: "b", perfumeId: "p", available: "5" },
    ] as UserPerfumeI[]
    const next = mergeListingIntoCollection(prev, {
      id: "a",
      perfumeId: "p",
      available: "0",
      pausedAvailable: "10",
    } as UserPerfumeI)
    expect(next).toHaveLength(2)
    expect(next[0]?.available).toBe("0")
    expect(next[0]?.pausedAvailable).toBe("10")
    expect(next[1]?.id).toBe("b")
  })
})

describe("pause payload omission", () => {
  it("pause/resume FormData should omit tradePrice and images", () => {
    const pause = new FormData()
    pause.append("action", "decant")
    pause.append("amount", "0")
    expect(pause.has("tradePrice")).toBe(false)
    expect(pause.has("images")).toBe(false)
  })
})
