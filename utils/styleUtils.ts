import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export const styleMerge = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

export const validImageRegex = /^o\.(?!26258\.jpg)\d+\.jpg$/;

/** Strips leading/trailing whitespace and ASCII control chars — next/image rejects those on `src`. */
export function normalizeRemoteImageSrc(src: string | null | undefined): string | null {
  if (src == null) return null
  const cleaned = src.replace(/^[\s\u0000-\u001F\u007F]+|[\s\u0000-\u001F\u007F]+$/g, "")
  return cleaned.length > 0 ? cleaned : null
}
