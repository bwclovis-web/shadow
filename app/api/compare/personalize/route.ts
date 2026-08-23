import { NextRequest, NextResponse } from "next/server"

import { getCompareMaxForEntitlements } from "@/constants/compare"
import { getComparePersonalization } from "@/models/compare-personalize.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { entitlementsForTier, resolveMembershipTier } from "@/utils/membership/entitlements.server"
import { compareIdsExceedMax, normalizeCompareIds } from "@/utils/compare-ids"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

function parseIdsFromRequest(request: NextRequest): string[] {
  const { searchParams } = request.nextUrl
  const repeated = searchParams.getAll("ids").flatMap(s => s.split(","))
  const single = searchParams.get("ids")
  const raw = repeated.length > 0 ? repeated : single ? single.split(",") : []
  return normalizeCompareIds(raw)
}

export const GET = async (request: NextRequest) => {
  const auth = await authenticateUser(request)
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: auth.status ?? 401 }
    )
  }

  const ids = parseIdsFromRequest(request)

  if (ids.length === 0) {
    return NextResponse.json({
      winnerId: null,
      explainNotes: [],
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { membershipTier: true, subscriptionStatus: true },
  })
  const tier = resolveMembershipTier(user ?? { membershipTier: "free" })
  const max = getCompareMaxForEntitlements(entitlementsForTier(tier))

  if (compareIdsExceedMax(ids, max)) {
    return NextResponse.json(
      { error: `At most ${max} perfumes can be compared` },
      { status: 400 }
    )
  }

  try {
    const result = await getComparePersonalization(auth.user.id, ids)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/compare/personalize]", error)
    return NextResponse.json(
      { error: "Failed to load personalization" },
      { status: 500 }
    )
  }
}
