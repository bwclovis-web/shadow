"use client"

import { compressImageFile } from "@/utils/listing-images-client"

export const uploadAvatarImage = async (
  file: File | Blob,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> => {
  const compressed =
    file instanceof File ? await compressImageFile(file, 512, 0.88) : file

  const formData = new FormData()
  const uploadFile =
    compressed instanceof File
      ? compressed
      : new File([compressed], "avatar.jpg", { type: "image/jpeg" })
  formData.append("file", uploadFile)

  const response = await fetch("/api/avatar-images", {
    method: "POST",
    headers: csrfHeaders,
    body: formData,
    credentials: "include",
  })

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean
    url?: string
    error?: string
  }

  if (!response.ok || !data.success || !data.url) {
    throw new Error(data.error ?? "Upload failed")
  }

  return { url: data.url }
}
