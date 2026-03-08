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
 * The response is a streaming JSON body: the server sends '\n' keepalive bytes
 * every 30 s while the scraper runs, then writes the final JSON payload and
 * closes the stream. This prevents browsers from closing idle connections
 * (Chrome's ~300 s idle socket timeout) during long scrape runs. JSON.parse
 * ignores leading whitespace so the client can call res.json() as usual.
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
 * Allow this route to run up to 30 minutes on Vercel/serverless deployments.
 * On local dev the streaming keepalive approach below keeps the connection alive.
 */
export const maxDuration = Math.ceil(SCRAPER_TIMEOUT_MS / 1000)

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

/** Spawn the Python scraper; resolve stdout JSON and stderr log. */
async function runPythonScraper(
  config: ScraperRunRequest,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scraper", "run_scraper.py")
    const child = spawn("python", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Scraper timed out after ${SCRAPER_TIMEOUT_MS / 1000}s`))
    }, SCRAPER_TIMEOUT_MS)

    child.on("close", (code: number | null) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`Scraper exited with code ${code}. Stderr: ${stderr.slice(0, 1000)}`))
      } else {
        resolve({ stdout, stderr })
      }
    })

    child.on("error", (err: Error) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start Python scraper: ${err.message}`))
    })

    child.stdin.write(
      JSON.stringify({
        houseName: config.houseName,
        collectionUrls: config.collectionUrls,
        productLinkSelector: config.productLinkSelector,
        nameSelector: config.nameSelector,
        descriptionSelector: config.descriptionSelector,
        imageSelector: config.imageSelector,
        skipKeywords: config.skipKeywords,
        baseUrl: config.baseUrl ?? "",
      }),
    )
    child.stdin.end()
  })
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
  // Streaming response — prevents browser idle-connection drops (Chrome ~300 s).
  // We send '\n' keepalive bytes every KEEPALIVE_INTERVAL_MS while the scraper
  // runs, then write the final JSON. JSON.parse ignores leading whitespace.
  // ---------------------------------------------------------------------------
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("\n"))
          // #region agent log
          fetch("http://127.0.0.1:7886/ingest/4d4b6cb5-ecca-41e8-a12b-7415fa8e44a7", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d246c8" },
            body: JSON.stringify({ sessionId: "d246c8", hypothesisId: "H-idle-timeout", location: "run/route.ts:keepalive", message: "Sent keepalive chunk", data: { ts: Date.now() }, timestamp: Date.now() }),
          }).catch(() => {})
          // #endregion
        } catch {
          // stream already closed; ignore
        }
      }, KEEPALIVE_INTERVAL_MS)

      // #region agent log
      fetch("http://127.0.0.1:7886/ingest/4d4b6cb5-ecca-41e8-a12b-7415fa8e44a7", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d246c8" },
        body: JSON.stringify({ sessionId: "d246c8", hypothesisId: "H-idle-timeout", location: "run/route.ts:stream-start", message: "Stream opened, scraper starting", data: {}, timestamp: Date.now() }),
      }).catch(() => {})
      // #endregion

      let result: ScraperRunResponse

      try {
        // Step 1: Python scraper
        let scrapedItems: ScrapedItem[] = []
        let scraperLog = ""
        try {
          const { stdout, stderr } = await runPythonScraper(body)
          scraperLog = stderr.trim()
          const parsed = JSON.parse(stdout) as unknown
          if (!Array.isArray(parsed)) throw new Error("Scraper output is not a JSON array")
          scrapedItems = parsed as ScrapedItem[]
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result = {
            ok: false,
            scrapedCount: 0,
            records: [],
            csvContent: "",
            errors: [`Scraper failed: ${msg}`],
            scraperLog: scraperLog || undefined,
          }
          clearInterval(keepalive)
          controller.enqueue(encoder.encode(JSON.stringify(result)))
          controller.close()
          return
        }

        if (scrapedItems.length === 0) {
          result = {
            ok: true,
            scrapedCount: 0,
            records: [],
            csvContent: "",
            errors: ["Scraper ran successfully but found 0 products. Check your collection URLs and selectors."],
            scraperLog: scraperLog || undefined,
          }
          clearInterval(keepalive)
          controller.enqueue(encoder.encode(JSON.stringify(result)))
          controller.close()
          return
        }

        // Step 2: LangGraph note extraction
        const pipelineOptions = {
          titleTakeBeforeDash: body.titleTakeBeforeDash ?? false,
          titleStripNumbers: body.titleStripNumbers ?? false,
          generateNoirDescriptions: body.generateNoirDescriptions ?? true,
        }
        let records: PerfumeCsvRecord[] = []
        try {
          records = await extractNotesForItems(scrapedItems, body.houseName, pipelineOptions)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result = {
            ok: false,
            scrapedCount: scrapedItems.length,
            records: [],
            csvContent: "",
            errors: [`Note extraction failed: ${msg}`],
          }
          clearInterval(keepalive)
          controller.enqueue(encoder.encode(JSON.stringify(result)))
          controller.close()
          return
        }

        result = {
          ok: true,
          scrapedCount: scrapedItems.length,
          records,
          csvContent: toCsv(records),
          errors: [],
          scraperLog: scraperLog || undefined,
        }

        // #region agent log
        fetch("http://127.0.0.1:7886/ingest/4d4b6cb5-ecca-41e8-a12b-7415fa8e44a7", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d246c8" },
          body: JSON.stringify({ sessionId: "d246c8", hypothesisId: "H-idle-timeout", location: "run/route.ts:stream-end", message: "Stream closing with result", data: { ok: result.ok, scrapedCount: result.scrapedCount }, timestamp: Date.now() }),
        }).catch(() => {})
        // #endregion

        clearInterval(keepalive)
        controller.enqueue(encoder.encode(JSON.stringify(result)))
        controller.close()
      } catch (err) {
        clearInterval(keepalive)
        const msg = err instanceof Error ? err.message : String(err)
        const errorResult: ScraperRunResponse = {
          ok: false,
          scrapedCount: 0,
          records: [],
          csvContent: "",
          errors: [`Unexpected error: ${msg}`],
        }
        try {
          controller.enqueue(encoder.encode(JSON.stringify(errorResult)))
          controller.close()
        } catch {
          // controller already closed
        }
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
