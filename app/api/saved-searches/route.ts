import { NextRequest, NextResponse } from "next/server"

import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  setSavedSearchAlertEnabled,
  type SavedSearchQuery,
} from "@/models/saved-search.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { isFeatureEnabled } from "@/utils/feature-flags"

export const GET = async (request: NextRequest) => {
  if (!isFeatureEnabled("savedSearches")) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
  }
  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }
  const entitlement = await requireEntitlement(auth.user!.id, "saved_searches")
  if (!entitlement.ok) {
    return NextResponse.json(
      {
        error: "Saved searches require Premium",
        upgradeRequired: true,
        tier: entitlement.tier,
      },
      { status: 403 }
    )
  }
  const searches = await listSavedSearches(auth.user!.id)
  return NextResponse.json({ success: true, searches })
}

export const POST = async (request: NextRequest) => {
  try {
    if (!isFeatureEnabled("savedSearches")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }
    const auth = await authenticateUser(request)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
    }
    const entitlement = await requireEntitlement(auth.user!.id, "saved_searches")
    if (!entitlement.ok) {
      return NextResponse.json(
        {
          error: "Saved searches require Premium",
          upgradeRequired: true,
          tier: entitlement.tier,
        },
        { status: 403 }
      )
    }
    const body = await request.json()
    await requireCSRFForJsonBody(request, body)

    if (body?.intent === "delete") {
      const id = typeof body?.id === "string" ? body.id : ""
      await deleteSavedSearch(auth.user!.id, id)
      return NextResponse.json({ success: true })
    }

    if (body?.intent === "toggle-alert") {
      const id = typeof body?.id === "string" ? body.id : ""
      await setSavedSearchAlertEnabled(auth.user!.id, id, Boolean(body?.alertEnabled))
      return NextResponse.json({ success: true })
    }

    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    const query = (body?.query ?? {}) as SavedSearchQuery
    const search = await createSavedSearch({
      userId: auth.user!.id,
      name,
      query,
      alertEnabled: body?.alertEnabled !== false,
    })
    return NextResponse.json({ success: true, search })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
