"use client"

import { compressImageFile } from "@/utils/listing-images-client"

export const uploadReportImage = async (
  file: File | Blob,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> => {
  const formData = new FormData()
  const uploadFile =
    file instanceof File
      ? file
      : new File([file], "report.jpg", { type: "image/jpeg" })
  formData.append("file", uploadFile)

  const response = await fetch("/api/report-images", {
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

export const compressAndUploadReportImage = async (
  file: File,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> => {
  const compressed = await compressImageFile(file)
  return uploadReportImage(compressed, csrfHeaders)
}
