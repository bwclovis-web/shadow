"use client"

import { uploadImage } from "@/lib/api-client"
import { compressImageFile } from "@/utils/listing-images-client"

export const uploadAvatarImage = async (
  file: File | Blob,
  csrfHeaders: HeadersInit
): Promise<{ url: string }> => {
  const compressed =
    file instanceof File ? await compressImageFile(file, 512, 0.88) : file

  return uploadImage("/api/avatar-images", compressed, csrfHeaders, "avatar.jpg")
}
