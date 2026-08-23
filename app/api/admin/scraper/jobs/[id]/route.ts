/**
 * GET    /api/admin/scraper/jobs/[id] — job status (DB)
 * DELETE /api/admin/scraper/jobs/[id] — request cancel
 * POST   /api/admin/scraper/jobs/[id] — actions: retry | process
 */

import { NextResponse, type NextRequest } from "next/server"

import {
  getScraperJob,
  requeueScraperJobForRetry,
  requestScraperJobCancel,
} from "@/models/scraper-job.server"
import {
  parseProgressJson,
  parseRecordsJson,
  toScraperRunResponse,
} from "@/lib/scraper/jobs/scraper-job-types"
import { recordsToCsv } from "@/lib/scraper/jobs/preview-normalize"
import { claimAndRunScraperJob } from "@/lib/scraper/jobs/worker-loop.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

export const maxDuration = 800

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const { id } = await context.params
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 })
  }

  const includeResults = new URL(request.url).searchParams.get("results") === "1"
  const job = await getScraperJob(id)
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 })
  }

  const progress = parseProgressJson(job.progressJson)
  const payload: Record<string, unknown> = {
    ok: true,
    source: "db",
    job: {
      id: job.id,
      status: job.status,
      collectionUrl: job.collectionUrl,
      houseName: job.houseName,
      platform: job.platform,
      progress,
      resultJson: job.resultJson,
      errorMessage: job.errorMessage,
      cancelRequested: job.cancelRequested,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      resumeStage: job.resumeStage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      lockedBy: job.lockedBy,
      lastHeartbeatAt: job.lastHeartbeatAt,
    },
  }

  if (includeResults) {
    const records = parseRecordsJson(job.partialRecordsJson)
    payload.results = toScraperRunResponse({
      ok: job.status === "completed" || records.length > 0,
      scrapedCount:
        typeof (job.resultJson as { scrapedCount?: number } | null)?.scrapedCount ===
        "number"
          ? (job.resultJson as { scrapedCount: number }).scrapedCount
          : records.length,
      records,
      csvContent: recordsToCsv(records),
      errors: job.errorMessage ? [job.errorMessage] : [],
      batchWarnings:
        (job.resultJson as { batchWarnings?: string[] } | null)?.batchWarnings,
      jobId: job.id,
    })
  }

  return NextResponse.json(payload)
}

export const DELETE = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const { id } = await context.params
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 })
  }

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as unknown
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

  const existing = await getScraperJob(id)
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 })
  }

  await requestScraperJobCancel(id)
  return NextResponse.json({ ok: true, cancelRequested: true, jobId: id })
}

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const { id } = await context.params
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 })
  }

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as unknown
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

  const intent =
    typeof body === "object" && body && "intent" in body
      ? String((body as { intent?: string }).intent)
      : "process"

  const existing = await getScraperJob(id)
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 })
  }

  if (intent === "retry") {
    try {
      const job = await requeueScraperJobForRetry(id)
      void claimAndRunScraperJob({ jobId: id }).catch(() => undefined)
      return NextResponse.json({ ok: true, jobId: job.id, status: job.status })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed"
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
  }

  if (intent === "process") {
    if (existing.status !== "queued" && existing.status !== "running") {
      return NextResponse.json(
        { ok: false, error: `Cannot process job in status ${existing.status}` },
        { status: 400 }
      )
    }
    void claimAndRunScraperJob({ jobId: id }).catch(err => {
      console.error(
        JSON.stringify({
          type: "scraper_job_process_error",
          jobId: id,
          message: err instanceof Error ? err.message : String(err),
        })
      )
    })
    return NextResponse.json({ ok: true, jobId: id, started: true })
  }

  return NextResponse.json({ ok: false, error: "Unknown intent" }, { status: 400 })
}
