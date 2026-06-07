/**
 * POST /api/admin/scraper/run
 *
 * Step 1 of the scraper flow: scrape + note extraction only.
 * Does NOT import to the database. The caller reviews the returned records
 * and triggers POST /api/admin/scraper/import to commit them.
 *
 * 1. Spawns scraper/run_scraper.py with the config on stdin; reads JSON from stdout.
 * 2. Runs the LangGraph note-extraction pipeline on the scraped items.
 * 3. Returns all extracted records + CSV content for preview/download.
 *
 * Response: NDJSON stream (application/x-ndjson). Each line is a JSON object:
 * - { "type": "log", "message": "..." } — progress line from Python stderr or keepalive
 * - { "type": "result", "data": <ScraperRunResponse> } — final payload (only line with type "result")
 *
 * The client should read the stream line-by-line and show progress; when type is "result", use data.
 * Keeps the connection alive during long runs and gives real-time progress.
 *
 * Requires admin or editor role.
 */

import { spawn, type ChildProcess } from "child_process"
import path from "path"

import { NextResponse, type NextRequest } from "next/server"

import { assessDuplicateRisk } from "@/lib/scraper/duplicate-review"
import {
  mapScrapedItemsToRecords,
  pythonPipelineComplete,
  scrapedItemsNeedNodeRepair,
  scrapedItemsNeedPatternEtsyEnrichment,
} from "@/lib/scraper/map-scraped-items"
import { extractNotesForItems, type ScraperPipelineOptions } from "@/lib/scraper/notes-graph"
import { isAllowedNotesPipelineModel, NOTES_PIPELINE_MODEL_ALLOWLIST } from "@/lib/scraper/notes-pipeline-models"
import { prisma } from "@/lib/db"
import type {
  PerfumeCsvRecord,
  ScrapedItem,
  ScraperRunRequest,
  ScraperRunResponse,
  TitleDashSegment,
} from "@/types/scraper"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Scraper timeout: env SCRAPER_TIMEOUT_MS (ms) or default 90 minutes (large Etsy runs need more). */
const SCRAPER_TIMEOUT_MS =
  typeof process.env.SCRAPER_TIMEOUT_MS === "string" &&
  /^\d+$/.test(process.env.SCRAPER_TIMEOUT_MS)
    ? Number(process.env.SCRAPER_TIMEOUT_MS)
    : 90 * 60 * 1000 // 90 minutes default

/**
 * Route max duration (seconds). Platform may kill the request after this.
 * Vercel Pro allows up to 800s; keep within 1–800 so deployment succeeds.
 * 300s (5 min) allows moderate scrapes; long runs should use local dev or smaller batches.
 */
export const maxDuration = 300

/** How often to send a keepalive '\n' to prevent browser idle-connection drops (ms). */
const KEEPALIVE_INTERVAL_MS = 25_000

const isAbortLike = (e: unknown): boolean =>
  (e instanceof DOMException && e.name === "AbortError") ||
  (e instanceof Error && e.name === "AbortError")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialise extracted records to CSV text. */
function toCsv(records: PerfumeCsvRecord[]): string {
  const headers = [
    "name",
    "description",
    "image",
    "perfumeHouse",
    "openNotes",
    "heartNotes",
    "baseNotes",
    "detailURL",
  ]
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = records.map(r =>
    [
      escape(r.name),
      escape(r.description),
      escape(r.image),
      escape(r.perfumeHouse),
      escape(r.openNotes),
      escape(r.heartNotes),
      escape(r.baseNotes),
      escape(r.detailURL),
    ].join(","),
  )
  return [headers.join(","), ...rows].join("\n")
}

const normalizePreviewName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const normalizePreviewDetailUrl = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "")

const NON_PERFUME_PRODUCT_URL_RE =
  /\/products\/(?:fragrance-sampler|gift-card|sample-pack|coupon|wish-list|file-claim)/i

const scorePreviewRecordCompleteness = (record: PerfumeCsvRecord): number => {
  const openCount = safeJsonArrayCount(record.openNotes)
  const heartCount = safeJsonArrayCount(record.heartNotes)
  const baseCount = safeJsonArrayCount(record.baseNotes)
  const descScore = record.description?.trim() ? 10 : 0
  const imageScore = record.image?.trim() ? 10 : 0
  const detailUrl = record.detailURL ?? ""
  const urlPenalty = NON_PERFUME_PRODUCT_URL_RE.test(detailUrl) ? -50 : 0
  const contentPagePenalty = /\/pages\//i.test(detailUrl) ? -40 : 0
  return openCount + heartCount + baseCount + descScore + imageScore + urlPenalty + contentPagePenalty
}

const safeJsonArrayCount = (value: string): number => {
  if (!value?.trim()) return 0
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

const dedupePreviewRecords = (
  records: PerfumeCsvRecord[],
): { records: PerfumeCsvRecord[]; warnings: string[] } => {
  const byKey = new Map<string, PerfumeCsvRecord>()
  const dropped: Array<{ key: string; kept: string; removed: string }> = []

  for (const record of records) {
    const house = (record.perfumeHouse ?? "").trim().toLowerCase()
    const name = normalizePreviewName(record.name ?? "")
    const detailUrl = normalizePreviewDetailUrl(record.detailURL ?? "")
    const image = (record.image ?? "").trim().toLowerCase()
    const keys = [
      detailUrl ? `url:${detailUrl}` : "",
      house && name ? `name:${house}|${name}` : "",
      house && name && image ? `name-image:${house}|${name}|${image}` : "",
    ].filter(Boolean)

    if (keys.length === 0) {
      byKey.set(`idx:${byKey.size}`, record)
      continue
    }

    let existingKey: string | null = null
    let existingRecord: PerfumeCsvRecord | undefined
    for (const key of keys) {
      const found = byKey.get(key)
      if (found) {
        existingKey = key
        existingRecord = found
        break
      }
    }

    if (!existingRecord || !existingKey) {
      for (const key of keys) byKey.set(key, record)
      continue
    }

    const existingScore = scorePreviewRecordCompleteness(existingRecord)
    const nextScore = scorePreviewRecordCompleteness(record)
    const keepNew = nextScore > existingScore
    const kept = keepNew ? record : existingRecord
    const removed = keepNew ? existingRecord : record
    for (const key of keys) byKey.set(key, kept)
    dropped.push({
      key: existingKey,
      kept: kept.name,
      removed: removed.name,
    })
  }

  const uniqueRecords = Array.from(new Set(byKey.values()))
  const warnings = dropped.length
    ? [
        `Removed ${dropped.length} duplicate preview row(s) by URL/name match before CSV export.`,
        ...dropped.slice(0, 3).map(d => `Deduped "${d.removed}" into "${d.kept}" (${d.key}).`),
      ]
    : []

  return { records: uniqueRecords, warnings }
}

const parseNoteJsonArray = (value: string): string[] => {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

const normalizeRecordNotes = (
  record: PerfumeCsvRecord,
): { record: PerfumeCsvRecord; removedCount: number } => {
  const open = parseNoteJsonArray(record.openNotes)
  const heart = parseNoteJsonArray(record.heartNotes)
  const base = parseNoteJsonArray(record.baseNotes)

  const seen = new Set<string>()
  const dedupeLayer = (arr: string[]): string[] =>
    arr.filter(note => {
      const key = note.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

  const openDeduped = dedupeLayer(open)
  const heartDeduped = dedupeLayer(heart)
  const baseDeduped = dedupeLayer(base)
  const before = open.length + heart.length + base.length
  const after = openDeduped.length + heartDeduped.length + baseDeduped.length

  return {
    record: {
      ...record,
      openNotes: JSON.stringify(openDeduped),
      heartNotes: JSON.stringify(heartDeduped),
      baseNotes: JSON.stringify(baseDeduped),
    },
    removedCount: Math.max(0, before - after),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Patterns that make a selector invalid in Selenium (CSS). */
const INVALID_SELECTOR_PATTERNS = [
  { pattern: /\n|\r/, message: "Selectors cannot contain newlines" },
  { pattern: /:contains\s*\(/i, message: ":contains() is not valid CSS (Selenium uses standard CSS; use attribute selectors instead)" },
  { pattern: /:first(?!-)/i, message: ":first is jQuery-only; use :first-child or :nth-child(1)" },
  {
    pattern: /(^|[\s>+~,])rte(?=$|[\s>+~,:#[.])/i,
    message: "Selector contains bare `rte`, which is usually Shopify's `.rte` class. Use `.product__accordion__inner .rte` instead of `.product__accordion__inner rte`.",
  },
  // Tailwind arbitrary-value pattern e.g. pt-[3.25rem] — looks like an attribute selector but isn't valid
  {
    pattern: /\[[\d.]/,
    message: "Selector contains a Tailwind arbitrary-value class (e.g. pt-[3.25rem]). These are Tailwind CSS utility classes, not valid CSS selectors. In Chrome DevTools, right-click the element → Copy → Copy selector, or use a stable class like .product-description or a data attribute like [data-component='Description'].",
  },
  // Tailwind responsive/variant prefix pattern e.g. tablet-landscape-s:pt-[…] or sm:text-lg
  // Matches a word-with-dash directly before a colon at a selector boundary (after space/combinator or at start).
  // Standard CSS pseudo-classes (a:hover, p:first-child) don't have dashes in the part before the colon.
  {
    pattern: /(?:^|[\s>+~,])[\w][\w-]+-[\w][\w-]*:/,
    message: "Selector contains a Tailwind responsive/variant prefix (e.g. tablet-landscape-s:, sm:, hover:). These are Tailwind CSS class-name prefixes, not valid CSS selectors. In Chrome DevTools, right-click the element → Copy → Copy selector, or pick a stable semantic class or data attribute.",
  },
]

function validateSelectors(body: ScraperRunRequest): string | null {
  const selectors = [
    { name: "Product link selector", value: body.productLinkSelector },
    { name: "Name selector", value: body.nameSelector },
    { name: "Description selector", value: body.descriptionSelector },
    { name: "Image selector", value: body.imageSelector },
  ]
  const notesSelectorTrimmed = (body.notesSelector ?? "").trim()
  if (notesSelectorTrimmed) {
    selectors.push({ name: "Notes selector", value: body.notesSelector!.trim() })
  }
  for (const { name, value } of selectors) {
    const trimmed = value.trim()
    if (!trimmed) return `${name} cannot be empty or whitespace.`
    for (const { pattern, message } of INVALID_SELECTOR_PATTERNS) {
      if (pattern.test(value)) return `${name}: ${message}`
    }
  }
  return null
}

const resolveTitleDashSegment = (body: ScraperRunRequest): TitleDashSegment => {
  const s = body.titleDashSegment
  if (s === "before" || s === "after" || s === "none") return s
  return body.titleTakeBeforeDash === true ? "before" : "none"
}

function validateBody(body: unknown): body is ScraperRunRequest {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  if (
    !(typeof b.houseName === "string" && b.houseName.trim().length > 0) ||
    !Array.isArray(b.collectionUrls) ||
    (b.collectionUrls as unknown[]).length === 0 ||
    typeof b.productLinkSelector !== "string" ||
    typeof b.nameSelector !== "string" ||
    typeof b.descriptionSelector !== "string" ||
    typeof b.imageSelector !== "string" ||
    !Array.isArray(b.skipKeywords)
  )
    return false
  if (b.titleOmitWords !== undefined && !Array.isArray(b.titleOmitWords)) return false
  if (b.titleDashSegment !== undefined && typeof b.titleDashSegment !== "string") return false
  if (b.titleColonSegment !== undefined && typeof b.titleColonSegment !== "string") return false
  if (b.titleTakeAfterFirstComma !== undefined && typeof b.titleTakeAfterFirstComma !== "boolean") return false
  if (b.titleTakeBeforeFirstComma !== undefined && typeof b.titleTakeBeforeFirstComma !== "boolean") return false
  if (
    b.noteInferenceMode !== undefined &&
    b.noteInferenceMode !== "standard" &&
    b.noteInferenceMode !== "strict"
  )
    return false
  if (
    b.minConfidentFlatNotes !== undefined &&
    (typeof b.minConfidentFlatNotes !== "number" || !Number.isFinite(b.minConfidentFlatNotes))
  )
    return false
  if (b.notesPipelineModel !== undefined && typeof b.notesPipelineModel !== "string") return false
  if (b.noirPipelineModel !== undefined && typeof b.noirPipelineModel !== "string") return false
  if (
    b.noteValidationMode !== undefined &&
    b.noteValidationMode !== "llm" &&
    b.noteValidationMode !== "off"
  )
    return false
  return true
}

const validatePipelineModels = (body: ScraperRunRequest): string | null => {
  const extra = body.notesPipelineModel?.trim()
  if (extra && !isAllowedNotesPipelineModel(extra)) {
    return `Invalid notesPipelineModel "${extra}". Allowed: ${NOTES_PIPELINE_MODEL_ALLOWLIST.join(", ")}`
  }
  const noir = body.noirPipelineModel?.trim()
  if (noir && !isAllowedNotesPipelineModel(noir)) {
    return `Invalid noirPipelineModel "${noir}". Allowed: ${NOTES_PIPELINE_MODEL_ALLOWLIST.join(", ")}`
  }
  return null
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = JSON.parse(await request.text()) as unknown
  } catch {
    return NextResponse.json(
      { ok: false, scrapedCount: 0, records: [], csvContent: "", errors: ["Invalid JSON body"] } satisfies ScraperRunResponse,
      { status: 400 },
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
        } satisfies ScraperRunResponse,
        { status: 403 },
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
      } satisfies ScraperRunResponse,
      { status: 400 },
    )
  }

  const selectorError = validateSelectors(body)
  if (selectorError) {
    return NextResponse.json(
      {
        ok: false,
        scrapedCount: 0,
        records: [],
        csvContent: "",
        errors: [
          selectorError,
          "Use valid CSS selectors only. For links use e.g. a[href*='/products/'] or a[href*='/p/']. Inspect the collection page in DevTools to see the correct link structure.",
        ],
      } satisfies ScraperRunResponse,
      { status: 400 },
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
      } satisfies ScraperRunResponse,
      { status: 400 },
    )
  }

  // ---------------------------------------------------------------------------
  // NDJSON stream: progress lines from Python stderr + final result.
  // Keeps connection alive and gives real-time progress.
  // ---------------------------------------------------------------------------
  const encoder = new TextEncoder()

  function sendLine(controller: ReadableStreamDefaultController<Uint8Array>, obj: object) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
  }

  /** Set in stream start so `cancel` can mirror `request.signal` abort (fetch cancelled by client). */
  let invokeClientAbort: (() => void) | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let scrapeClientAborted = false
      let scrapeKillTimer: ReturnType<typeof setTimeout> | undefined
      let keepaliveTimer: ReturnType<typeof setInterval> | undefined
      let keepalivePhase = "scraping"

      let stdout = ""
      let scraperLog = ""
      let stderrBuffer = ""

      const scriptPath = path.join(process.cwd(), "scraper", "run_scraper.py")
      const venvPython = process.platform === "win32"
        ? path.join(process.cwd(), "scraper", ".venv", "Scripts", "python.exe")
        : path.join(process.cwd(), "scraper", ".venv", "bin", "python")
      const pythonCmd = process.env.SCRAPER_PYTHON || venvPython
      const pythonArgs = [scriptPath]
      const childRef: { current: ChildProcess | null } = { current: null }

      const clearScrapeKillTimer = () => {
        if (scrapeKillTimer !== undefined) {
          clearTimeout(scrapeKillTimer)
          scrapeKillTimer = undefined
        }
      }

      const clearKeepalive = () => {
        if (keepaliveTimer !== undefined) {
          clearInterval(keepaliveTimer)
          keepaliveTimer = undefined
        }
      }

      const clearScrapeTimers = () => {
        clearScrapeKillTimer()
        clearKeepalive()
      }

      const killPythonIfRunning = () => {
        const p = childRef.current
        if (p && p.exitCode === null) {
          try {
            p.kill()
          } catch {
            // ignore
          }
        }
      }

      let clientAbortHandled = false
      const onClientAbort = () => {
        if (clientAbortHandled) return
        clientAbortHandled = true
        scrapeClientAborted = true
        request.signal.removeEventListener("abort", onClientAbort)
        clearScrapeTimers()
        killPythonIfRunning()
      }

      invokeClientAbort = onClientAbort
      request.signal.addEventListener("abort", onClientAbort)

      keepaliveTimer = setInterval(() => {
        try {
          const phase =
            keepalivePhase === "scraping"
              ? "Scraper still running…"
              : keepalivePhase === "notes"
                ? "Note extraction still running…"
                : "Finalizing results…"
          sendLine(controller, { type: "log", message: phase })
        } catch {
          // stream already closed
        }
      }, KEEPALIVE_INTERVAL_MS)

      const child = spawn(pythonCmd, pythonArgs, { stdio: ["pipe", "pipe", "pipe"] })
      childRef.current = child
      const childStdin = child.stdin
      const childStdout = child.stdout
      const childStderr = child.stderr
      if (childStdin === null || childStdout === null || childStderr === null) {
        clearScrapeTimers()
        request.signal.removeEventListener("abort", onClientAbort)
        invokeClientAbort = null
        const result: ScraperRunResponse = {
          ok: false,
          scrapedCount: 0,
          records: [],
          csvContent: "",
          errors: ["Python subprocess did not expose stdin/stdout/stderr pipes."],
        }
        try {
          sendLine(controller, { type: "result", data: result })
          controller.close()
        } catch {
          // ignore
        }
        return
      }

      childStdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8")
      })
      childStderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8")
        scraperLog += text
        stderrBuffer += text
        const lines = stderrBuffer.split("\n")
        stderrBuffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed) {
            try {
              sendLine(controller, { type: "log", message: trimmed })
            } catch {
              break
            }
          }
        }
      })

      scrapeKillTimer = setTimeout(() => {
        child?.kill()
      }, SCRAPER_TIMEOUT_MS)

      childStdin.write(
        JSON.stringify({
          houseName: body.houseName,
          collectionUrls: body.collectionUrls,
          productLinkSelector: body.productLinkSelector,
          nameSelector: body.nameSelector,
          descriptionSelector: body.descriptionSelector,
          notesSelector: (body.notesSelector ?? "").trim() || "",
          imageSelector: body.imageSelector,
          skipKeywords: body.skipKeywords,
          titleOmitWords: Array.isArray(body.titleOmitWords) ? body.titleOmitWords : [],
          baseUrl: body.baseUrl ?? "",
          etsyHeaded: body.etsyHeaded === true,
          headed: body.headed === true,
          skipSizeVariants: body.skipSizeVariants !== false,
          delayBetweenUrlsMs:
            typeof body.delayBetweenUrlsMs === "number" && body.delayBetweenUrlsMs >= 0
              ? body.delayBetweenUrlsMs
              : undefined,
          retryAttempts:
            typeof body.retryAttempts === "number" && body.retryAttempts >= 1
              ? body.retryAttempts
              : undefined,
          // Notes pipeline options forwarded to the Python pipeline
          generateNoirDescriptions: body.generateNoirDescriptions ?? true,
          noteValidationMode: body.noteValidationMode === "off" ? "off" : "llm",
          notesPipelineModel: body.notesPipelineModel?.trim() || undefined,
          noirPipelineModel: body.noirPipelineModel?.trim() || undefined,
          discoveryMode: body.discoveryMode ?? "auto",
          maxProducts:
            typeof body.maxProducts === "number" && body.maxProducts > 0
              ? body.maxProducts
              : undefined,
          platformHint: body.platformHint?.trim() || undefined,
          externalNoteRescue: body.externalNoteRescue !== false,
          jobId: body.jobId?.trim() || undefined,
          titleDashSegment: resolveTitleDashSegment(body),
          titleColonSegment:
            body.titleColonSegment === "before" ||
            body.titleColonSegment === "after" ||
            body.titleColonSegment === "none"
              ? body.titleColonSegment
              : "none",
          titleTakeAfterFirstComma: body.titleTakeAfterFirstComma === true,
          titleTakeBeforeFirstComma: body.titleTakeBeforeFirstComma === true,
          titleStripNumbers: body.titleStripNumbers ?? false,
        }),
      )
      childStdin.end()

      const detachAbortListener = () => {
        request.signal.removeEventListener("abort", onClientAbort)
      }

      child.on("close", async (code: number | null) => {
        clearScrapeKillTimer()
        try {
          child?.stdin?.destroy()
          child?.stdout?.destroy()
          child?.stderr?.destroy()
        } catch {
          // ignore
        }

        if (scrapeClientAborted) {
          detachAbortListener()
          invokeClientAbort = null
          clearKeepalive()
          try {
            controller.close()
          } catch {
            // ignore
          }
          return
        }

        if (stderrBuffer.trim()) {
          try {
            sendLine(controller, { type: "log", message: stderrBuffer.trim() })
          } catch {
            // client gone
          }
        }

        let result: ScraperRunResponse

        try {
          if (code !== 0) {
            result = {
              ok: false,
              scrapedCount: 0,
              records: [],
              csvContent: "",
              errors: [`Scraper exited with code ${code}. Stderr: ${scraperLog.slice(0, 1000)}`],
              scraperLog: scraperLog.trim() || undefined,
            }
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            sendLine(controller, { type: "result", data: result })
            controller.close()
            return
          }

          const parsed = JSON.parse(stdout) as unknown
          if (!Array.isArray(parsed)) {
            result = {
              ok: false,
              scrapedCount: 0,
              records: [],
              csvContent: "",
              errors: ["Scraper output is not a JSON array"],
              scraperLog: scraperLog.trim() || undefined,
            }
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            sendLine(controller, { type: "result", data: result })
            controller.close()
            return
          }

          const scrapedItems = parsed as ScrapedItem[]

          if (scrapedItems.length === 0) {
            result = {
              ok: true,
              scrapedCount: 0,
              records: [],
              csvContent: "",
              errors: ["Scraper ran successfully but found 0 products. Check your collection URLs and selectors."],
              scraperLog: scraperLog.trim() || undefined,
            }
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            sendLine(controller, { type: "result", data: result })
            controller.close()
            return
          }

          if (request.signal.aborted || scrapeClientAborted) {
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            try {
              controller.close()
            } catch {
              // ignore
            }
            return
          }

          const hasPythonNotes = pythonPipelineComplete(scrapedItems)
          const needsNodeEnrichment = scrapedItemsNeedPatternEtsyEnrichment(scrapedItems)
          const needsNodeRepair = scrapedItemsNeedNodeRepair(scrapedItems)
          const skipNodeNotesPipeline = hasPythonNotes && !needsNodeEnrichment && !needsNodeRepair

          keepalivePhase = skipNodeNotesPipeline ? "finalize" : "notes"

          try {
            sendLine(controller, {
              type: "log",
              message: skipNodeNotesPipeline
                ? `Python notes pipeline complete — mapping ${scrapedItems.length} product(s) (skipping duplicate Node LLM pass).`
                : hasPythonNotes
                  ? needsNodeRepair
                    ? `Python pipeline complete — Node repair pass for ${scrapedItems.length} product(s) (compliance/URL fixes; progress lines follow).`
                    : `Python pipeline complete — Node enrichment for ${scrapedItems.length} product(s) (progress lines follow).`
                  : `Starting note extraction for ${scrapedItems.length} products (Node.js pipeline — progress lines follow).`,
            })
          } catch {
            // ignore
          }

          const pipelineOptions: ScraperPipelineOptions = {
            enrichOnly: hasPythonNotes,
            titleDashSegment: resolveTitleDashSegment(body),
            titleColonSegment:
              body.titleColonSegment === "before" || body.titleColonSegment === "after" || body.titleColonSegment === "none"
                ? body.titleColonSegment
                : "none",
            titleTakeAfterFirstComma: body.titleTakeAfterFirstComma === true,
            titleTakeBeforeFirstComma: body.titleTakeBeforeFirstComma === true,
            titleStripNumbers: body.titleStripNumbers ?? false,
            titleOmitWords: Array.isArray(body.titleOmitWords) ? body.titleOmitWords : [],
            generateNoirDescriptions: body.generateNoirDescriptions ?? true,
            fetchPdpNoteBootstrap: body.fetchPdpNoteBootstrap !== false,
            noteInferenceMode: body.noteInferenceMode === "strict" ? "strict" : "standard",
            minConfidentFlatNotes:
              typeof body.minConfidentFlatNotes === "number" &&
              body.minConfidentFlatNotes >= 1 &&
              body.minConfidentFlatNotes <= 50
                ? Math.floor(body.minConfidentFlatNotes)
                : undefined,
            notesPipelineModel: body.notesPipelineModel?.trim() || undefined,
            noirPipelineModel: body.noirPipelineModel?.trim() || undefined,
            noteValidationMode: body.noteValidationMode === "off" ? "off" : "llm",
            abortSignal: request.signal,
            onProgress: (message: string) => {
              try {
                sendLine(controller, { type: "log", message })
              } catch {
                // stream closed
              }
            },
          }
          const { records: nodeRecords, batchWarnings } = skipNodeNotesPipeline
            ? { records: mapScrapedItemsToRecords(scrapedItems, body.houseName), batchWarnings: [] as string[] }
            : await extractNotesForItems(scrapedItems, body.houseName, pipelineOptions)
          const { records: dedupedRecords, warnings: dedupeWarnings } = dedupePreviewRecords(nodeRecords)
          let removedRepeatedNotes = 0
          const notesNormalizedRecords = dedupedRecords.map(r => {
            const normalized = normalizeRecordNotes(r)
            removedRepeatedNotes += normalized.removedCount
            return normalized.record
          })
          const noteWarnings =
            removedRepeatedNotes > 0
              ? [`Removed ${removedRepeatedNotes} repeated note entries across open/heart/base layers.`]
              : []
          const records = await assessDuplicateRisk(notesNormalizedRecords, { prismaClient: prisma })
          const combinedWarnings = [...batchWarnings, ...dedupeWarnings, ...noteWarnings]

          result = {
            ok: true,
            scrapedCount: scrapedItems.length,
            records,
            csvContent: toCsv(records),
            errors: [],
            scraperLog: scraperLog.trim() || undefined,
            batchWarnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
          }
          detachAbortListener()
          invokeClientAbort = null
          clearKeepalive()
          sendLine(controller, { type: "result", data: result })
          controller.close()
        } catch (err) {
          if (isAbortLike(err) && (scrapeClientAborted || request.signal.aborted)) {
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            try {
              controller.close()
            } catch {
              // ignore
            }
            return
          }
          const msg = err instanceof Error ? err.message : String(err)
          result = {
            ok: false,
            scrapedCount: 0,
            records: [],
            csvContent: "",
            errors: [`Unexpected error: ${msg}`],
            scraperLog: scraperLog.trim() || undefined,
          }
          try {
            detachAbortListener()
            invokeClientAbort = null
            clearKeepalive()
            sendLine(controller, { type: "result", data: result })
            controller.close()
          } catch {
            // already closed
          }
        }
      })

      child.on("error", (err: Error) => {
        clearScrapeTimers()
        detachAbortListener()
        invokeClientAbort = null
        const result: ScraperRunResponse = {
          ok: false,
          scrapedCount: 0,
          records: [],
          csvContent: "",
          errors: [`Failed to start Python scraper: ${err.message}`],
        }
        try {
          sendLine(controller, { type: "result", data: result })
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      invokeClientAbort?.()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  })
}
