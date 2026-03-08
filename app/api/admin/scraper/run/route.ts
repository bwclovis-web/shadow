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

import { spawn } from "child_process"
import path from "path"

import { NextResponse, type NextRequest } from "next/server"

import { extractNotesForItems } from "@/lib/scraper/notes-graph"
import type {
  PerfumeCsvRecord,
  ScrapedItem,
  ScraperRunRequest,
  ScraperRunResponse,
} from "@/types/scraper"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Scraper timeout: env SCRAPER_TIMEOUT_MS (ms) or default 30 minutes. */
const SCRAPER_TIMEOUT_MS =
  typeof process.env.SCRAPER_TIMEOUT_MS === "string" &&
  /^\d+$/.test(process.env.SCRAPER_TIMEOUT_MS)
    ? Number(process.env.SCRAPER_TIMEOUT_MS)
    : 30 * 60 * 1000 // 30 minutes default

/**
 * Vercel Pro allows max 800s; scraper is only used on localhost where no limit applies.
 * Kept within 1–800 so deployment succeeds.
 */
export const maxDuration = 60

/** How often to send a keepalive '\n' to prevent browser idle-connection drops (ms). */
const KEEPALIVE_INTERVAL_MS = 25_000

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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Patterns that make a selector invalid in Selenium (CSS). */
const INVALID_SELECTOR_PATTERNS = [
  { pattern: /\n|\r/, message: "Selectors cannot contain newlines" },
  { pattern: /:contains\s*\(/i, message: ":contains() is not valid CSS (Selenium uses standard CSS; use attribute selectors instead)" },
  { pattern: /:first(?!-)/i, message: ":first is jQuery-only; use :first-child or :nth-child(1)" },
]

function validateSelectors(body: ScraperRunRequest): string | null {
  const selectors = [
    { name: "Product link selector", value: body.productLinkSelector },
    { name: "Name selector", value: body.nameSelector },
    { name: "Description selector", value: body.descriptionSelector },
    { name: "Image selector", value: body.imageSelector },
  ]
  for (const { name, value } of selectors) {
    const trimmed = value.trim()
    if (!trimmed) return `${name} cannot be empty or whitespace.`
    for (const { pattern, message } of INVALID_SELECTOR_PATTERNS) {
      if (pattern.test(value)) return `${name}: ${message}`
    }
  }
  return null
}

function validateBody(body: unknown): body is ScraperRunRequest {
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, scrapedCount: 0, records: [], csvContent: "", errors: ["Invalid JSON body"] } satisfies ScraperRunResponse,
      { status: 400 },
    )
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

  // ---------------------------------------------------------------------------
  // NDJSON stream: progress lines from Python stderr + final result.
  // Keeps connection alive and gives real-time progress.
  // ---------------------------------------------------------------------------
  const encoder = new TextEncoder()

  function sendLine(controller: ReadableStreamDefaultController<Uint8Array>, obj: object) {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const keepalive = setInterval(() => {
        try {
          sendLine(controller, { type: "log", message: "Still running…" })
        } catch {
          // stream already closed
        }
      }, KEEPALIVE_INTERVAL_MS)

      let stdout = ""
      let scraperLog = ""
      let stderrBuffer = ""

      const scriptPath = path.join(process.cwd(), "scraper", "run_scraper.py")
      const child = spawn("python", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] })

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8")
      })
      child.stderr.on("data", (chunk: Buffer) => {
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

      const timer = setTimeout(() => {
        child.kill()
      }, SCRAPER_TIMEOUT_MS)

      child.stdin.write(
        JSON.stringify({
          houseName: body.houseName,
          collectionUrls: body.collectionUrls,
          productLinkSelector: body.productLinkSelector,
          nameSelector: body.nameSelector,
          descriptionSelector: body.descriptionSelector,
          imageSelector: body.imageSelector,
          skipKeywords: body.skipKeywords,
          baseUrl: body.baseUrl ?? "",
        }),
      )
      child.stdin.end()

      child.on("close", async (code: number | null) => {
        clearTimeout(timer)
        clearInterval(keepalive)
        // Release child stdio so the process can be fully reaped
        try {
          child.stdin?.destroy()
          child.stdout?.destroy()
          child.stderr?.destroy()
        } catch {
          // ignore
        }
        if (stderrBuffer.trim()) sendLine(controller, { type: "log", message: stderrBuffer.trim() })

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
            sendLine(controller, { type: "result", data: result })
            controller.close()
            return
          }

          try {
            sendLine(controller, { type: "log", message: `Extracting notes from ${scrapedItems.length} products…` })
          } catch {
            // ignore
          }

          const pipelineOptions = {
            titleTakeBeforeDash: body.titleTakeBeforeDash ?? false,
            titleStripNumbers: body.titleStripNumbers ?? false,
            generateNoirDescriptions: body.generateNoirDescriptions ?? true,
          }
          const records = await extractNotesForItems(scrapedItems, body.houseName, pipelineOptions)

          result = {
            ok: true,
            scrapedCount: scrapedItems.length,
            records,
            csvContent: toCsv(records),
            errors: [],
            scraperLog: scraperLog.trim() || undefined,
          }
          sendLine(controller, { type: "result", data: result })
          controller.close()
        } catch (err) {
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
            sendLine(controller, { type: "result", data: result })
            controller.close()
          } catch {
            // already closed
          }
        }
      })

      child.on("error", (err: Error) => {
        clearTimeout(timer)
        clearInterval(keepalive)
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
  })

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  })
}
