import { resolveTraderCountry } from "@/utils/country-list"

export const getTraderRegionLabel = (region: string): string =>
  resolveTraderCountry(region)?.name ?? region

export const normalizeInstagramHandle = (raw: string | null | undefined): string | null => {
  const trimmed = raw?.trim().replace(/^@+/, "") ?? ""
  return trimmed.length > 0 ? trimmed : null
}

export const normalizeRedditUsername = (raw: string | null | undefined): string | null => {
  const trimmed = raw?.trim().replace(/^\/?u\//i, "").replace(/^@+/, "") ?? ""
  return trimmed.length > 0 ? trimmed : null
}

export const buildInstagramUrl = (handle: string): string =>
  `https://www.instagram.com/${encodeURIComponent(handle)}/`

export const buildRedditUrl = (username: string): string =>
  `https://www.reddit.com/user/${encodeURIComponent(username)}/`

export const getInitials = (displayName: string): string => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}
