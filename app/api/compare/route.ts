import { NextRequest, NextResponse } from "next/server"

import { getCompareMaxForEntitlements } from "@/constants/compare"
import { getComparePayload } from "@/models/compare.server"
import { entitlementsForTier, resolveMembershipTier } from "@/utils/membership/entitlements.server"
import { compareIdsExceedMax, normalizeCompareIds } from "@/utils/compare-ids"
import { authenticateUser } from "@/utils/server/auth.server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

function parseIdsFromRequest(request: NextRequest): string[] {
  const { searchParams } = request.nextUrl
  const repeated = searchParams.getAll("ids").flatMap(s => s.split(","))
  const single = searchParams.get("ids")
  const raw = repeated.length > 0 ? repeated : single ? single.split(",") : []
  return normalizeCompareIds(raw)
}

const resolveCompareMax = async (request: NextRequest): Promise<number> => {
  const auth = await authenticateUser(request)
  if (!auth.success || !auth.user) {
    return getCompareMaxForEntitlements([])
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { membershipTier: true, subscriptionStatus: true },
  })
  const tier = resolveMembershipTier(user ?? { membershipTier: "free" })
  return getCompareMaxForEntitlements(entitlementsForTier(tier))
}

export const GET = async (request: NextRequest) => {
  const ids = parseIdsFromRequest(request)

  if (ids.length === 0) {
    return NextResponse.json({ perfumes: [] satisfies unknown[] })
  }

  const max = await resolveCompareMax(request)
  if (compareIdsExceedMax(ids, max)) {
    return NextResponse.json(
      { error: `At most ${max} perfumes can be compared` },
      { status: 400 }
    )
  }

  try {
    const perfumes = await getComparePayload(ids)
    return NextResponse.json({ perfumes })
  } catch (error) {
    console.error("[api/compare]", error)
    return NextResponse.json(
      { error: "Failed to load compare data" },
      { status: 500 }
    )
  }
}
