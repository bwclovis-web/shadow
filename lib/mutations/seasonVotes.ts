import { useMutation } from "@tanstack/react-query"

import type { SeasonSelection } from "@/types/perfume-season-vote"

export interface SaveSeasonVoteParams extends SeasonSelection {
  perfumeId: string
}

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null
  const csrfCookie = document.cookie
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("_csrf="))
  return csrfCookie ? decodeURIComponent(csrfCookie.split("=")[1]) : null
}

const saveSeasonVote = async (params: SaveSeasonVoteParams): Promise<{ message?: string }> => {
  const { perfumeId, winter, spring, summer, fall } = params
  const csrfToken = getCsrfToken()
  const formData = new FormData()
  formData.append("perfumeId", perfumeId)
  formData.append("winter", String(winter))
  formData.append("spring", String(spring))
  formData.append("summer", String(summer))
  formData.append("fall", String(fall))
  if (csrfToken) formData.append("_csrf", csrfToken)

  const response = await fetch("/api/perfume-season-votes", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || "Failed to save season vote")
  }
  return response.json()
}

export const useSaveSeasonVote = () =>
  useMutation({
    mutationFn: saveSeasonVote,
  })
