/**
 * POST /api/admin/scraper/run
 *
 * Compatibility entry point: validates config, creates a durable ScraperJob,
 * optionally starts an inline worker, and returns { ok, jobId }.
 *
 * Prefer POST /api/admin/scraper/jobs + polling GET /api/admin/scraper/jobs/:id.
 * Long scrapes should use `npm run scraper:worker` (or SCRAPER_INLINE_WORKER).
 */

import { NextResponse, type NextRequest } from "next/server"

import { isAllowedNotesPipelineModel, NOTES_PIPELINE_MODEL_ALLOWLIST } from "@/lib/scraper/notes-pipeline-models"
import { claimAndRunScraperJob } from "@/lib/scraper/jobs/worker-loop.server"
import { createScraperJob } from "@/models/scraper-job.server"
import type { ScraperConfig } from "@/types/scraper"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

export const maxDuration = 60

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

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = JSON.parse(await request.text()) as unknown
  } catch {
    return NextResponse.json(
      { ok: false, scrapedCount: 0, records: [], csvContent: "", errors: ["Invalid JSON body"] },
      { status: 400 }
    )
  }

  try {
    await requireCSRFForJsonBody(request, body)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        {
          ok: false,
          scrapedCount: 0,
          records: [],
          csvContent: "",
          errors: [error.message],
        },
        { status: 403 }
      )
    }
    throw error
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        ok: false,
        scrapedCount: 0,
        records: [],
        csvContent: "",
        errors: [
          "Missing required fields: houseName, collectionUrls (array), productLinkSelector, nameSelector, descriptionSelector, imageSelector, skipKeywords (array)",
        ],
      },
      { status: 400 }
    )
  }

  const modelError = validatePipelineModels(body)
  if (modelError) {
    return NextResponse.json(
      {
        ok: false,
        scrapedCount: 0,
        records: [],
        csvContent: "",
        errors: [modelError],
      },
      { status: 400 }
    )
  }

  const job = await createScraperJob({
    collectionUrl: body.collectionUrls[0] ?? "",
    houseName: body.houseName,
    platform: body.platformHint?.trim() || null,
    createdByUserId: auth.user.id,
    config: body,
  })

  if (process.env.SCRAPER_INLINE_WORKER !== "false") {
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
    status: "queued",
    scrapedCount: 0,
    records: [],
    csvContent: "",
    errors: [],
    message:
      "Durable scraper job created. Poll GET /api/admin/scraper/jobs/:id (and ?results=1 when complete).",
  })
}
