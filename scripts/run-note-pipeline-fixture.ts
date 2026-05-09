/**
 * Run `extractNotesForItems` on a JSON fixture — useful for A/B comparing note extraction
 * against an older revision of this repo (see `scripts/compare-notes-pipeline-worktree.sh`).
 *
 * Fixture shape:
 * {
 *   "houseName": string,
 *   "items": ScrapedItem[],
 *   "options"?: ScraperPipelineOptions,
 *   "model"?: string
 * }
 *
 * Usage (from repo root):
 *   OPENAI_API_KEY=... npx tsx scripts/run-note-pipeline-fixture.ts fixtures/note-pipeline-compare.json
 *
 * Optional env:
 *   OPENAI_NOTES_MODEL=gpt-4o-mini   (overrides fixture.model)
 *
 * Output: JSON array of { name, detailURL, openNotes, heartNotes, baseNotes, descriptionPreview }
 */

import * as fs from "fs"
import * as path from "path"

import { extractNotesForItems } from "@/lib/scraper/notes-graph"
import type { PerfumeCsvRecord, ScrapedItem, ScraperPipelineOptions } from "@/types/scraper"

type Fixture = {
  houseName: string
  items: ScrapedItem[]
  options?: ScraperPipelineOptions
  model?: string
}

const loadFixture = (filePath: string): Fixture => {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
  const raw = fs.readFileSync(abs, "utf8")
  const data = JSON.parse(raw) as unknown
  if (!data || typeof data !== "object" || !("items" in data) || !("houseName" in data)) {
    throw new Error("Fixture must include houseName and items[]")
  }
  const f = data as Fixture
  if (!Array.isArray(f.items) || f.items.length === 0) {
    throw new Error("Fixture items must be a non-empty array")
  }
  return f
}

const summarize = (records: PerfumeCsvRecord[]) =>
  records.map(r => ({
    name: r.name,
    detailURL: r.detailURL,
    openNotes: JSON.parse(r.openNotes) as string[],
    heartNotes: JSON.parse(r.heartNotes) as string[],
    baseNotes: JSON.parse(r.baseNotes) as string[],
    descriptionPreview: (r.description ?? "").slice(0, 160),
  }))

const main = async () => {
  const argv = process.argv.slice(2).filter(a => a !== "--")
  const fixturePath = argv[0]
  if (!fixturePath) {
    console.error("Usage: npx tsx scripts/run-note-pipeline-fixture.ts <fixture.json>")
    process.exit(1)
  }

  const fixture = loadFixture(fixturePath)
  const model = process.env.OPENAI_NOTES_MODEL ?? fixture.model ?? "gpt-4o-mini"

  const records = await extractNotesForItems(
    fixture.items,
    fixture.houseName,
    fixture.options ?? {},
    model,
  )

  console.log(JSON.stringify(summarize(records), null, 2))
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
