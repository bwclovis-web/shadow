import { NextRequest, NextResponse } from "next/server"

import { buildPersonalizedDigest } from "@/models/personalized-digest.server"
import { isFeatureEnabled } from "@/utils/feature-flags"
import { authenticateUser } from "@/utils/server/auth.server"

export const GET = async (request: NextRequest) => {
  if (!isFeatureEnabled("personalizedDigests")) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
  }
  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }
  const digest = await buildPersonalizedDigest(auth.user!.id)
  if (!digest) {
    return NextResponse.json(
      { error: "Personalized digests require Premium", upgradeRequired: true },
      { status: 403 }
    )
  }
  return NextResponse.json({ success: true, digest })
}
