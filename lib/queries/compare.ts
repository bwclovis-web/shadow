import type { ComparePerfumeDto } from "@/models/compare.server"

export const compareQueryKeys = {
  all: ["compare"] as const,
  byOrderedIds: (ids: string[]) => [...compareQueryKeys.all, ids.join("|")] as const,
}

export type CompareApiResponse = {
  perfumes: ComparePerfumeDto[]
  error?: string
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
