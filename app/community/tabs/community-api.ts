import { apiFetch, getCSRFFromCookie, getCsrfHeaders } from "@/lib/api-client"

import type { PerfumeOption } from "./types"

export const postCommunity = async (body: Record<string, unknown>) => {
  const csrf = getCSRFFromCookie()
  return apiFetch<{ success: boolean; error?: string }>("/api/community", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getCsrfHeaders(),
    },
    body: JSON.stringify({
      ...body,
      ...(csrf ? { _csrf: csrf } : {}),
    }),
  })
}

export const loadCollectionPerfumeOptions = async (): Promise<PerfumeOption[]> => {
  const data = await apiFetch<{
    userPerfumes?: Array<{
      perfumeId: string
      perfume?: { name?: string; slug?: string }
    }>
  }>("/api/user-perfumes")
  const opts: PerfumeOption[] = []
  const seen = new Set<string>()
  for (const row of data.userPerfumes ?? []) {
    if (!row.perfumeId || seen.has(row.perfumeId)) continue
    seen.add(row.perfumeId)
    opts.push({
      perfumeId: row.perfumeId,
      name: row.perfume?.name ?? row.perfumeId,
      slug: row.perfume?.slug ?? "",
    })
  }
  opts.sort((a, b) => a.name.localeCompare(b.name))
  return opts
}
