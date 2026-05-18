import { describe, expect, it, vi } from "vitest"

import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"

import {
  deleteListingImagesFromR2,
  LISTING_PUBLISH_ERROR_CODES,
  parseListingImagesJson,
  parseListingMetadataFromFormData,
  validateListingPublish,
} from "./listing-metadata.server"

vi.mock("@/lib/r2", () => ({
  deleteFromR2: vi.fn(),
  getR2KeyFromPublicUrl: vi.fn(),
}))

vi.mock("@/utils/listing-config.server", () => ({
  isListingPhotoRequired: () => true,
}))

describe("listing-metadata.server", () => {
  it("parses images JSON array", () => {
    expect(parseListingImagesJson('["https://cdn/a.jpg"]')).toEqual([
      "https://cdn/a.jpg",
    ])
    expect(parseListingImagesJson("not-json")).toEqual([])
  })

  it("parses full metadata from form data", () => {
    const formData = new FormData()
    formData.append("images", JSON.stringify(["https://cdn/a.jpg"]))
    formData.append("condition", "mint")
    formData.append("decantFormat", "vial")

    expect(parseListingMetadataFromFormData(formData)).toEqual({
      images: ["https://cdn/a.jpg"],
      condition: "mint",
      decantFormat: "vial",
    })
  })

  it("requires photo when publishing with photos enforced", () => {
    expect(
      validateListingPublish("10", {
        images: [],
        condition: null,
        decantFormat: null,
      })
    ).toEqual({
      ok: false,
      errorCode: LISTING_PUBLISH_ERROR_CODES.photoRequired,
    })

    expect(
      validateListingPublish("0", {
        images: [],
        condition: null,
        decantFormat: null,
      })
    ).toEqual({ ok: true })

    expect(
      validateListingPublish(
        "10",
        { images: [], condition: null, decantFormat: null },
        { resumingPausedListing: true }
      )
    ).toEqual({ ok: true })
  })

  it("deletes listing images from R2 when key is under listings/", async () => {
    vi.mocked(getR2KeyFromPublicUrl).mockImplementation((url) =>
      url.includes("listings/") ? "listings/user-1/photo.jpg" : null
    )

    await deleteListingImagesFromR2([
      "https://cdn.example.com/listings/user-1/photo.jpg",
      "https://example.com/external.jpg",
    ])

    expect(deleteFromR2).toHaveBeenCalledTimes(1)
    expect(deleteFromR2).toHaveBeenCalledWith("listings/user-1/photo.jpg")
  })
})
