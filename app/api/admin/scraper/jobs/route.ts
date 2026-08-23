/**
 * GET  /api/admin/scraper/jobs — list recent jobs
 * POST /api/admin/scraper/jobs — create a durable job from scraper config
 */

import { NextResponse, type NextRequest } from "next/server"

import {
  createScraperJob,
  listRecentScraperJobs,
} from "@/models/scraper-job.server"
import { claimAndRunScraperJob } from "@/lib/scraper/jobs/worker-loop.server"
import type { ScraperConfig } from "@/types/scraper"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"
import { isAllowedNotesPipelineModel, NOTES_PIPELINE_MODEL_ALLOWLIST } from "@/lib/scraper/notes-pipeline-models"

const validateBody = (body: unknown): body is ScraperConfig => {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  return (
    typeof b.houseName === "string" &&
    b.houseName.trim().length > 0 &&
    Array.isArray(b.collectionUrls) &&
    (b.collectionUrls as unknown[]).length > 0 &&
    typeof b.productLinkSelector === "string" &&
    typeof b.nameSelector === "string" &&
    typeof b.descriptionSelector === "string" &&
    typeof b.imageSelector === "string" &&
    Array.isArray(b.skipKeywords)
  )
}

const validatePipelineModels = (body: ScraperConfig): string | null => {
  const notes = body.notesPipelineModel?.trim()
  if (notes && !isAllowedNotesPipelineModel(notes)) {
    return `Invalid notesPipelineModel "${notes}". Allowed: ${NOTES_PIPELINE_MODEL_ALLOWLIST.join(", ")}`
  }
  const noir = body.noirPipelineModel?.trim()
  if (noir && !isAllowedNotesPipelineModel(noir)) {
    return `Invalid noirPipelineModel "${noir}". Allowed: ${NOTES_PIPELINE_MODEL_ALLOWLIST.join(", ")}`
  }
  return null
}

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const limitRaw = new URL(request.url).searchParams.get("limit")
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20))
  const jobs = await listRecentScraperJobs(limit)
  return NextResponse.json({ ok: true, jobs })
}

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = JSON.parse(await request.text()) as unknown
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  try {
    await requireCSRFForJsonBody(request, body)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 })
    }
    throw error
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing required fields: houseName, collectionUrls, productLinkSelector, nameSelector, descriptionSelector, imageSelector, skipKeywords",
      },
      { status: 400 }
    )
  }

  const modelError = validatePipelineModels(body)
  if (modelError) {
    return NextResponse.json({ ok: false, error: modelError }, { status: 400 })
  }

  const job = await createScraperJob({
    collectionUrl: body.collectionUrls[0] ?? "",
    houseName: body.houseName,
    platform: body.platformHint?.trim() || null,
    createdByUserId: auth.user.id,
    config: body,
  })

  const startInline = process.env.SCRAPER_INLINE_WORKER !== "false"
  if (startInline) {
    void claimAndRunScraperJob({ jobId: job.id }).catch(err => {
      console.error(
        JSON.stringify({
          type: "scraper_job_inline_error",
          jobId: job.id,
          message: err instanceof Error ? err.message : String(err),
        })
      )
    })
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    inlineWorker: startInline,
  })
}
