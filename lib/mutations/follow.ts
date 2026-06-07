import { useMutation } from "@tanstack/react-query"

import { getCsrfHeaders } from "@/lib/api-client"

export type FollowTargetType = "user" | "house" | "perfume"

export interface FollowActionParams {
  targetType: FollowTargetType
  targetId: string
  action: "follow" | "unfollow"
}

export interface FollowActionResponse {
  success: boolean
  data?: {
    following: boolean
    followerCount?: number
  }
  error?: string
}

const followAction = async (params: FollowActionParams): Promise<FollowActionResponse> => {
  const formData = new FormData()
  formData.append("action", params.action)
  formData.append("targetType", params.targetType)
  formData.append("targetId", params.targetId)

  const response = await fetch("/api/follow", {
    method: "POST",
    body: formData,
    headers: getCsrfHeaders(),
  })

  const json = (await response.json()) as FollowActionResponse & {
    following?: boolean
    followerCount?: number
    error?: string
  }

  if (!response.ok || !json.success) {
    return { success: false, error: json.error ?? "Request failed" }
  }

  return {
    success: true,
    data: {
      following: json.following ?? params.action === "follow",
      followerCount: json.followerCount,
    },
  }
}

export const useFollowMutation = () =>
  useMutation({
    mutationFn: followAction,
  })
