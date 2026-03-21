/**
 * Refresh notes and descriptions for a perfume house using the LangGraph pipeline.
 * Loads existing perfumes from the DB, extracts notes from their descriptions,
 * optionally generates film noir descriptions, then updates the DB (replaces
 * note relations and description). No re-scraping.
 *
 * Run from project root:
 *   npm run refresh:house-notes
 *   npm run refresh:house-notes -- "Other House"
 *   npm run refresh:house-notes -- --dry-run
 *   npm run refresh:house-notes -- --no-noir
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

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgv(): {
  houseNameFromArg: string | null
  dryRun: boolean
  noNoir: boolean
} {
  const args = process.argv.slice(2)
  let houseNameFromArg: string | null = null
  let dryRun = false
  let noNoir = false

  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true
    else if (arg === "--no-noir") noNoir = true
    else if (!arg.startsWith("--") && arg.trim() && houseNameFromArg === null) {
      houseNameFromArg = arg.trim()
    }
  }
  return { houseNameFromArg, dryRun, noNoir }
}

function promptHouseName(defaultName: string): Promise<string> {
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

async function main() {
  const { houseNameFromArg, dryRun, noNoir } = parseArgv()

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
  const records = await extractNotesForItems(items, house.name, {
    generateNoirDescriptions: !noNoir,
  })

  if (dryRun) {
    console.log("\nWould update the following (description snippet + notes):\n")
    for (const r of records) {
      const open = JSON.parse(r.openNotes || "[]") as string[]
      const heart = JSON.parse(r.heartNotes || "[]") as string[]
      const base = JSON.parse(r.baseNotes || "[]") as string[]
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
