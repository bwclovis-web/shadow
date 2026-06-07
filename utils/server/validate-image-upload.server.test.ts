import { describe, expect, it } from "vitest"

import {
  detectImageMimeFromBuffer,
  validateUploadedImage,
} from "@/utils/server/validate-image-upload.server"

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const webpBytes = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "ascii"),
])

const toFile = (buffer: Buffer, type: string): File =>
  ({
    type,
    size: buffer.length,
    arrayBuffer: async () => {
      const copy = new Uint8Array(buffer.length)
      copy.set(buffer)
      return copy.buffer
    },
  }) as File

describe("detectImageMimeFromBuffer", () => {
  it("detects JPEG signatures", () => {
    expect(detectImageMimeFromBuffer(jpegBytes)).toBe("image/jpeg")
  })

  it("detects PNG signatures", () => {
    expect(detectImageMimeFromBuffer(pngBytes)).toBe("image/png")
  })

  it("detects WebP signatures", () => {
    expect(detectImageMimeFromBuffer(webpBytes)).toBe("image/webp")
  })

  it("rejects non-image bytes", () => {
    expect(detectImageMimeFromBuffer(Buffer.from("hello"))).toBeNull()
  })
})

describe("validateUploadedImage", () => {
  it("accepts JPEG when magic bytes and MIME match", async () => {
    const result = await validateUploadedImage(toFile(jpegBytes, "image/jpeg"))
    expect(result).toEqual({ ok: true, buffer: jpegBytes, mime: "image/jpeg" })
  })

  it("rejects spoofed MIME type", async () => {
    const result = await validateUploadedImage(toFile(jpegBytes, "image/png"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("declared image type")
    }
  })

  it("rejects non-image content", async () => {
    const result = await validateUploadedImage(
      toFile(Buffer.from("not-an-image"), "image/jpeg")
    )
    expect(result.ok).toBe(false)
  })
})
