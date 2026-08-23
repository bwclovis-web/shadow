import sharp from "sharp"

import { detectImageMimeFromBuffer } from "@/utils/server/validate-image-upload.server"

export const R2_WEBP_CONTENT_TYPE = "image/webp" as const

/** Quality for newly encoded WebP uploads (already-WebP buffers are left as-is). */
const WEBP_QUALITY = 82

/**
 * Normalize an R2 object key so it ends with `.webp`.
 * `perfumes/abc.jpg` → `perfumes/abc.webp`
 * `avatars/u/id` → `avatars/u/id.webp`
 */
export const normalizeR2ObjectKeyToWebp = (key: string): string => {
  const cleaned = key.trim().replace(/^\/+/, "")
  if (!cleaned) {
    throw new Error("R2 object key is required")
  }
  const withoutExt = cleaned.replace(/\.[a-z0-9]+$/i, "")
  return `${withoutExt}.webp`
}

/**
 * Convert image bytes to WebP for R2 storage.
 * Buffers that are already WebP are returned unchanged.
 */
export const prepareImageBufferForR2 = async (buffer: Buffer): Promise<Buffer> => {
  if (!buffer?.length) {
    throw new Error("Image buffer is empty")
  }
  if (detectImageMimeFromBuffer(buffer) === "image/webp") {
    return buffer
  }
  return sharp(buffer, { failOn: "none" }).rotate().webp({ quality: WEBP_QUALITY }).toBuffer()
}
