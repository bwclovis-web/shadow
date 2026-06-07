const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp"

const ALLOWED_MIMES = new Set<AllowedImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
])

const matchesSignature = (buffer: Buffer, signature: readonly number[]): boolean =>
  signature.every((byte, index) => buffer[index] === byte)

export const detectImageMimeFromBuffer = (buffer: Buffer): AllowedImageMime | null => {
  if (buffer.length < 3) return null

  if (matchesSignature(buffer, JPEG_SIGNATURE)) return "image/jpeg"
  if (buffer.length >= PNG_SIGNATURE.length && matchesSignature(buffer, PNG_SIGNATURE)) {
    return "image/png"
  }

  if (buffer.length >= 12) {
    const isWebp =
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    if (isWebp) return "image/webp"
  }

  return null
}

export type ValidatedImageUpload =
  | { ok: true; buffer: Buffer; mime: AllowedImageMime }
  | { ok: false; error: string }

/**
 * Validate uploaded image bytes against magic-number signatures and declared MIME type.
 */
export const validateUploadedImage = async (
  file: File,
  allowedTypes: Set<string> = ALLOWED_MIMES
): Promise<ValidatedImageUpload> => {
  if (!allowedTypes.has(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed" }
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(new Uint8Array(arrayBuffer))
  const detectedMime = detectImageMimeFromBuffer(buffer)

  if (!detectedMime) {
    return { ok: false, error: "File content does not match a supported image format" }
  }

  if (detectedMime !== file.type) {
    return { ok: false, error: "File content does not match the declared image type" }
  }

  return { ok: true, buffer, mime: detectedMime }
}
