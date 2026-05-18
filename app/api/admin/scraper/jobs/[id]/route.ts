/**
 * GET /api/admin/scraper/jobs/[id] — read resumable job state from scraper/.runs/
 */

import fs from "fs"
import path from "path"

import { NextResponse, type NextRequest } from "next/server"

import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const runsDir = () => path.join(process.cwd(), "scraper", ".runs")

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const { id } = await context.params
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 })
  }

  const filePath = path.join(runsDir(), `${id}.json`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 })
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  const data = JSON.parse(raw) as unknown
  return NextResponse.json({ ok: true, job: data })
}
