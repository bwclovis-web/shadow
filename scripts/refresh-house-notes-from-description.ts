/**
 * Refresh notes and descriptions for a perfume house using the LangGraph pipeline.
 * Loads existing perfumes from the DB, extracts notes from their descriptions,
 * optionally generates film noir descriptions, then updates the DB (replaces
 * note relations and description). No re-scraping.
 *
 * Run from project root:
 *   npm run refresh:house-notes
 *   npm run refresh:house-notes -- Other House
 *   npm run refresh:house-notes -- "Other House"   (quotes also work)
 *   npm run refresh:house-notes -- --dry-run
 *   npm run refresh:house-notes -- --no-noir
 *   npm run refresh:house-notes -- --validate   (optional: bulk LLM note validation, same as admin scraper)
 *
 * By default, bulk LLM note validation is **off** for this script — it runs on the whole house at once
 * and can drop legitimate materials from stored descriptions. Pass `--validate` to enable it.
 *
 * Requires OPENAI_API_KEY and DATABASE_URL.
 */

const DEFAULT_HOUSE_NAME = "Heretic Parfum"

import * as readline from "readline"
import { PrismaClient } from "@prisma/client"

import { extractNotesForItems } from "@/lib/scraper/notes-graph"
import { importPerfumeRecords } from "@/lib/import-perfume-csv"
import type { ScrapedItem } from "@/types/scraper"

const prisma = new PrismaClient()

const parseNotesColumn = (json: string | undefined, recordName: string, column: string): string[] => {
  const raw = json ?? "[]"
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      console.warn(`  [warn] ${recordName}: ${column} is not a JSON array, skipping. Raw: ${raw.slice(0, 80)}`)
      return []
    }
    return parsed.map(String).map(s => s.trim()).filter(Boolean)
  } catch {
    console.warn(`  [warn] ${recordName}: invalid JSON in ${column}: ${raw.slice(0, 120)}…`)
    return []
  }
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const parseArgv = (): {
  houseNameFromArg: string | null
  dryRun: boolean
  noNoir: boolean
  validateNotes: boolean
} => {
  const args = process.argv.slice(2)
  const positional: string[] = []
  let dryRun = false
  let noNoir = false
  let validateNotes = false

  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true
    else if (arg === "--no-noir") noNoir = true
    else if (arg === "--validate") validateNotes = true
    else if (!arg.startsWith("--") && arg.trim()) {
      positional.push(arg.trim())
    }
  }

  const houseNameFromArg = positional.length > 0 ? positional.join(" ") : null
  return { houseNameFromArg, dryRun, noNoir, validateNotes }
}

const promptHouseName = (defaultName: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(
      `Enter house name (or press Enter for '${defaultName}'): `,
      answer => {
        rl.close()
        const trimmed = answer?.trim() ?? ""
        resolve(trimmed ? trimmed : defaultName)
      },
    )
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  const { houseNameFromArg, dryRun, noNoir, validateNotes } = parseArgv()

  const houseName = houseNameFromArg ?? (await promptHouseName(DEFAULT_HOUSE_NAME))
  if (!houseName) {
    console.error("House name is required.")
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Note extraction requires an OpenAI key.")
    process.exit(1)
  }

  if (dryRun) {
    console.log("DRY RUN – no changes will be made.\n")
  }

  if (!validateNotes) {
    console.log("Note: bulk LLM validation is OFF (use --validate to enable).\n")
  }

  const house = await prisma.perfumeHouse.findFirst({
    where: { name: { equals: houseName, mode: "insensitive" } },
  })

  if (!house) {
    console.error(`House not found: ${houseName}`)
    process.exit(1)
  }

  console.log(`Found house: ${house.name} (id: ${house.id})\n`)

  const perfumes = await prisma.perfume.findMany({
    where: { perfumeHouseId: house.id },
    select: { id: true, name: true, description: true, image: true },
    orderBy: { name: "asc" },
  })

  if (perfumes.length === 0) {
    console.log("No perfumes found for this house.")
    await prisma.$disconnect()
    return
  }

  const emptyDesc = perfumes.filter(p => !p.description?.trim())
  if (emptyDesc.length > 0) {
    console.log(
      `Warning: ${emptyDesc.length} perfume(s) have no description (pipeline will use name/house fallback):`,
    )
    emptyDesc.forEach(p => console.log(`  - ${p.name}`))
    console.log("")
  }

  const items: ScrapedItem[] = perfumes.map(p => ({
    name: p.name,
    description: p.description ?? "",
    image: p.image ?? "",
    detailURL: "",
    perfumeHouse: house.name,
  }))

  console.log(`Extracting notes and generating descriptions for ${items.length} perfumes…`)
  const { records, batchWarnings } = await extractNotesForItems(items, house.name, {
    generateNoirDescriptions: !noNoir,
    noteValidationMode: validateNotes ? "llm" : "off",
    onProgress: (message: string) => {
      console.log(`  ${message}`)
    },
  })

  if (batchWarnings.length > 0) {
    console.log("\nBatch warnings:")
    batchWarnings.forEach(w => console.log(`  ${w}`))
    console.log("")
  }

  if (dryRun) {
    console.log("\nWould update the following (description snippet + notes):\n")
    for (const r of records) {
      const open = parseNotesColumn(r.openNotes, r.name, "openNotes")
      const heart = parseNotesColumn(r.heartNotes, r.name, "heartNotes")
      const base = parseNotesColumn(r.baseNotes, r.name, "baseNotes")
      console.log(`  ${r.name}`)
      console.log(`    description: ${(r.description || "").slice(0, 120)}…`)
      console.log(`    open: ${open.join(", ") || "(none)"}`)
      console.log(`    heart: ${heart.join(", ") || "(none)"}`)
      console.log(`    base: ${base.join(", ") || "(none)"}`)
      console.log("")
    }
    await prisma.$disconnect()
    return
  }

  const summary = await importPerfumeRecords(records, {
    prismaClient: prisma,
    overwriteImageUrls: false,
  })

  console.log(`\nImported: ${summary.successful.length} succeeded`)
  if (summary.errors.length > 0) {
    console.error("Errors:")
    summary.errors.forEach(e => console.error(`  ${e.record.name}: ${e.error}`))
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
