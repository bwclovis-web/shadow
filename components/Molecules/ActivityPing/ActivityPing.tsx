"use client"

import { useActivityPing } from "@/hooks/useActivityPing"

type ActivityPingProps = {
  userId: string | null | undefined
}

/** Records presence for the "Recently active" indicator while the app is open. */
const ActivityPing = ({ userId }: ActivityPingProps) => {
  useActivityPing(userId)
  return null
}

export default ActivityPing
