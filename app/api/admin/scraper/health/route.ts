/**
 * GET /api/admin/scraper/health
 *
 * Lightweight reachability check for the scraper API. Used by the admin UI
 * to verify the server is running and the request can reach it (e.g. after
 * "Failed to fetch" to distinguish timeout vs server down).
 *
 * Requires admin or editor role.
 */

import { NextResponse } from "next/server"

import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response
  return NextResponse.json({ ok: true })
}
