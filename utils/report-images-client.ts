"use client"

import { uploadImage } from "@/lib/api-client"
import { compressImageFile } from "@/utils/listing-images-client"

export const uploadReportImage = async (
  file: File | Blob,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> =>
  uploadImage("/api/report-images", file, csrfHeaders, "report.jpg")

export const compressAndUploadReportImage = async (
  file: File,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> => {
  const compressed = await compressImageFile(file)
  return uploadReportImage(compressed, csrfHeaders)
}
