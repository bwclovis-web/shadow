import { NextResponse } from "next/server"

import { getVapidPublicKey, isPushConfigured } from "@/utils/push-vapid.server"

export const GET = async () => {
  const publicKey = getVapidPublicKey()
  if (!publicKey || !isPushConfigured()) {
    return NextResponse.json({ publicKey: null, configured: false })
  }
  return NextResponse.json({ publicKey, configured: true })
}
