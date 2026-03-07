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
// Helpers
// ---------------------------------------------------------------------------

/** Scraper timeout: env SCRAPER_TIMEOUT_MS (ms) or default 30 minutes. */
const SCRAPER_TIMEOUT_MS =
  typeof process.env.SCRAPER_TIMEOUT_MS === "string" &&
  /^\d+$/.test(process.env.SCRAPER_TIMEOUT_MS)
    ? Number(process.env.SCRAPER_TIMEOUT_MS)
    : 30 * 60 * 1000 // 30 minutes default

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

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json(
      {
        ok: false,
        scrapedCount: 0,
        records: [],
        csvContent: "",
        errors: [`Scraper failed: ${msg}`],
        scraperLog: scraperLog || undefined,
      } satisfies ScraperRunResponse,
      { status: 500 },
    )
  }

  if (scrapedItems.length === 0) {
    return NextResponse.json({
      ok: true,
      scrapedCount: 0,
      records: [],
      csvContent: "",
      errors: [
        "Scraper ran successfully but found 0 products. Check your collection URLs and selectors.",
      ],
      scraperLog: scraperLog || undefined,
    } satisfies ScraperRunResponse)
  }

  // Step 2: LangGraph note extraction (+ optional title cleaning & film noir descriptions)
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
    return NextResponse.json(
      {
        ok: false,
        scrapedCount: scrapedItems.length,
        records: [],
        csvContent: "",
        errors: [`Note extraction failed: ${msg}`],
      } satisfies ScraperRunResponse,
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    scrapedCount: scrapedItems.length,
    records,
    csvContent: toCsv(records),
    errors: [],
    scraperLog: scraperLog || undefined,
  } satisfies ScraperRunResponse)
}
