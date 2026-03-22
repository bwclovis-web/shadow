import type { ComparePerfumeDto } from "@/models/compare.server"

export const compareQueryKeys = {
  all: ["compare"] as const,
  byOrderedIds: (ids: string[]) => [...compareQueryKeys.all, ids.join("|")] as const,
}

export type CompareApiResponse = {
  perfumes: ComparePerfumeDto[]
  error?: string
}

export type ComparePersonalizeResponse = {
  winnerId: string | null
  explainNotes: { name: string }[]
  error?: string
}

export const comparePersonalizeQueryKeys = {
  all: ["compare", "personalize"] as const,
  byOrderedIds: (ids: string[]) =>
    [...comparePersonalizeQueryKeys.all, ids.join("|")] as const,
}

export async function fetchComparePersonalize(
  orderedIds: string[]
): Promise<ComparePersonalizeResponse> {
  if (orderedIds.length === 0) {
    return { winnerId: null, explainNotes: [] }
  }

  const params = new URLSearchParams()
  params.set("ids", orderedIds.join(","))

  const res = await fetch(`/api/compare/personalize?${params.toString()}`, {
    credentials: "include",
  })
  const body = (await res.json()) as ComparePersonalizeResponse

  if (res.status === 401) {
    return { winnerId: null, explainNotes: [] }
  }

  if (!res.ok) {
    throw new Error(body.error ?? "Failed to load personalization")
  }

  return {
    winnerId: body.winnerId ?? null,
    explainNotes: body.explainNotes ?? [],
  }
}

export async function fetchComparePerfumes(
  orderedIds: string[]
): Promise<ComparePerfumeDto[]> {
  if (orderedIds.length === 0) return []

  const params = new URLSearchParams()
  params.set("ids", orderedIds.join(","))

  const res = await fetch(`/api/compare?${params.toString()}`)
  const body = (await res.json()) as CompareApiResponse

  if (!res.ok) {
    throw new Error(body.error ?? "Failed to load compare data")
  }

  return body.perfumes ?? []
}
