"use client"

import { uploadImage } from "@/lib/api-client"

const MAX_EDGE = 1200
const JPEG_QUALITY = 0.85

export const compressImageFile = async (
  file: File,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY
): Promise<Blob> => {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    throw new Error("Could not prepare image canvas")
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

export const uploadListingImage = async (
  file: File | Blob,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> =>
  uploadImage("/api/listing-images", file, csrfHeaders, "listing.jpg")
