/**
 * Refresh notes and descriptions for a perfume house using the LangGraph pipeline.
 * Loads existing perfumes from the DB, extracts notes from their descriptions,
 * optionally generates film noir descriptions, then updates the DB (replaces
 * note relations and description). No re-scraping.
 *
 * Run from project root:
 *   npm run refresh:house-notes
 *   npm run refresh:house-notes -- Milano Fragranze
 *   npm run refresh:house-notes -- "Milano Fragranze"
 *   npm run refresh:house-notes -- --dry-run
 *   npm run refresh:house-notes -- --no-noir
 *   npm run refresh:house-notes -- --force-notes   (re-extract even when description is noir-only; may thin notes)
 *   npm run refresh:house-notes -- --validate   (optional: bulk LLM note validation, same as admin scraper)
 *
 * **Milano Fragranze / Artistic Fragrances:** stored descriptions are often noir prose only
 * (no Head/Heart/Base pyramid). By default this script **preserves existing DB note layers** and only
 * refreshes noir copy. Note re-extraction runs only when the stored description already contains
 * Head/Heart/Base lines, or when you pass `--force-notes` (not recommended for Milano — noir prose
 * cannot recover materials like Lavandin E.O.). For full pyramids, re-scrape with visible browser first.
 *
 * By default, bulk LLM note validation is **off** for this script — it runs on the whole house at once
 * and can drop legitimate materials from stored descriptions. Pass `--validate` to enable it.
 *
 * Requires OPENAI_API_KEY and DATABASE_URL.
 */

const DEFAULT_HOUSE_NAME = "Heretic Parfum"

import * as readline from "readline"
import { ChatOpenAI } from "@langchain/openai"
import { PrismaClient, type PerfumeNoteType } from "@prisma/client"

import { extractNotesForItems } from "@/lib/scraper/notes-graph"
import { importPerfumeRecords } from "@/lib/import-perfume-csv"
import { generateNoirDescription, openingFingerprint } from "@/lib/scraper/stages/noir-description"
import type { PerfumeCsvRecord, ScrapedItem } from "@/types/scraper"

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

const hasMerchantPyramidInText = (text: string): boolean => {
  const t = text ?? ""
  return (
    /\b(?:head|top|opening)\s+notes?\s*:/i.test(t) &&
    /\b(?:heart|middle|mid|core)\s+notes?\s*:/i.test(t) &&
    /\bbase\s+notes?\s*:/i.test(t)
  )
}

const isMilanoFragranzeHouse = (houseName: string): boolean =>
  houseName.trim().toLowerCase() === "milano fragranze"

const buildMilanoFragranzeDetailUrl = (slug: string): string =>
  `https://artisticfragrances.com/milano-fragranze/${slug.replace(/^\/+|\/+$/g, "")}/`

const buildPyramidNotesText = (open: string[], heart: string[], base: string[]): string =>
  [
    open.length ? `Head Notes: ${open.join(", ")}` : "",
    heart.length ? `Heart Notes: ${heart.join(", ")}` : "",
    base.length ? `Base Notes: ${base.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

const dbPyramidComplete = (open: string[], heart: string[], base: string[]): boolean =>
  open.length > 0 &&
  heart.length > 0 &&
  base.length > 0 &&
  open.length + heart.length + base.length >= 6

const notesForLayer = (
  relations: Array<{ noteType: PerfumeNoteType; note: { name: string } }>,
  layer: PerfumeNoteType,
): string[] => relations.filter(r => r.noteType === layer).map(r => r.note.name)

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const parseArgv = (): {
  houseNameFromArg: string | null
  dryRun: boolean
  noNoir: boolean
  forceNotes: boolean
  validateNotes: boolean
} => {
  const args = process.argv.slice(2)
  const positional: string[] = []
  let dryRun = false
  let noNoir = false
  let forceNotes = false
  let validateNotes = false

  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true
    else if (arg === "--no-noir") noNoir = true
    else if (arg === "--force-notes") forceNotes = true
    else if (arg === "--validate") validateNotes = true
    else if (!arg.startsWith("--") && arg.trim()) {
      positional.push(arg.trim())
    }
  }

  const houseNameFromArg = positional.length > 0 ? positional.join(" ") : null
  return { houseNameFromArg, dryRun, noNoir, forceNotes, validateNotes }
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
  const { houseNameFromArg, dryRun, noNoir, forceNotes, validateNotes } = parseArgv()

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
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      perfumeNoteRelations: {
        select: {
          noteType: true,
          note: { select: { name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  if (perfumes.length === 0) {
    console.log("No perfumes found for this house.")
    await prisma.$disconnect()
    return
  }

type DbPerfumeRow = (typeof perfumes)[number]

type PreparedPerfume = {
  perfume: DbPerfumeRow
  open: string[]
  heart: string[]
  base: string[]
  rawDesc: string
  descHasPyramid: boolean
  item: ScrapedItem
}

const buildPreparedPerfume = (p: DbPerfumeRow, houseName: string): PreparedPerfume => {
  const open = notesForLayer(p.perfumeNoteRelations, "open")
  const heart = notesForLayer(p.perfumeNoteRelations, "heart")
  const base = notesForLayer(p.perfumeNoteRelations, "base")
  const rawDesc = (p.description ?? "").trim()
  const notesTextFromDb = buildPyramidNotesText(open, heart, base)
  const descHasPyramid = hasMerchantPyramidInText(rawDesc)
  const dbComplete = dbPyramidComplete(open, heart, base)

  let description = rawDesc
  let notesText = ""

  if (descHasPyramid) {
    notesText = notesTextFromDb
  } else if (notesTextFromDb) {
    description = `${notesTextFromDb}\n\n${rawDesc}`.trim()
    notesText = notesTextFromDb
  }

  const detailURL =
    isMilanoFragranzeHouse(houseName) && p.slug ? buildMilanoFragranzeDetailUrl(p.slug) : ""

  const item: ScrapedItem = {
    name: p.name,
    description,
    notesText,
    image: p.image ?? "",
    detailURL,
    perfumeHouse: houseName,
  }

  if (dbComplete && !descHasPyramid) {
    item.openNotes = open
    item.heartNotes = heart
    item.baseNotes = base
    item._noteSource = "text_regex_layered"
  }

  return { perfume: p, open, heart, base, rawDesc, descHasPyramid, item }
}

const buildPreserveRecord = async (
  prepared: PreparedPerfume,
  houseName: string,
  noirLlm: ChatOpenAI | undefined,
  noNoir: boolean,
  previousOpenings: string[],
  index: number,
  total: number,
): Promise<PerfumeCsvRecord> => {
  const { perfume, open, heart, base, rawDesc } = prepared
  let description = perfume.description ?? ""

  if (!noNoir && noirLlm) {
    const notesSnippet =
      open.length + heart.length + base.length > 0
        ? buildPyramidNotesText(open, heart, base)
        : rawDesc.slice(0, 500)
    description = await generateNoirDescription(
      noirLlm,
      perfume.name,
      { openNotes: open, heartNotes: heart, baseNotes: base },
      notesSnippet,
      previousOpenings,
      index,
      total,
    )
  }

  return {
    name: perfume.name,
    description,
    image: perfume.image ?? "",
    perfumeHouse: houseName,
    openNotes: JSON.stringify(open),
    heartNotes: JSON.stringify(heart),
    baseNotes: JSON.stringify(base),
    detailURL:
      isMilanoFragranzeHouse(houseName) && perfume.slug
        ? buildMilanoFragranzeDetailUrl(perfume.slug)
        : "",
  }
}

  const prepared = perfumes.map(p => buildPreparedPerfume(p, house.name))
  const prepWarnings: string[] = []

  for (const p of prepared) {
    if (p.descHasPyramid) continue
    const dbComplete = dbPyramidComplete(p.open, p.heart, p.base)
    if (!p.rawDesc && p.open.length + p.heart.length + p.base.length === 0) {
      prepWarnings.push(`${p.perfume.name}: no description and no stored notes`)
    } else if (!forceNotes) {
      prepWarnings.push(
        dbComplete
          ? `${p.perfume.name}: noir-only description — DB notes will be preserved (only noir may refresh)`
          : `${p.perfume.name}: stored description has no Head/Heart/Base pyramid — DB notes preserved; re-scrape with visible browser or paste merchant pyramid into description, then run without --force-notes`,
      )
    } else {
      prepWarnings.push(
        `${p.perfume.name}: --force-notes enabled — re-extracting from noir + any stored note layers (may thin notes)`,
      )
    }
  }

  if (prepWarnings.length > 0) {
    console.log("Preparation warnings:")
    prepWarnings.forEach(w => console.log(`  ⚠ ${w}`))
    console.log("")
  }

  const toExtract = prepared.filter(p => p.descHasPyramid || forceNotes)
  const toPreserve = prepared.filter(p => !p.descHasPyramid && !forceNotes)

  const emptyDesc = prepared.filter(
    p => !p.item.description?.trim() && !p.item.notesText?.trim(),
  )
  if (emptyDesc.length > 0) {
    console.log(
      `Warning: ${emptyDesc.length} perfume(s) have no description or notes source:`,
    )
    emptyDesc.forEach(p => console.log(`  - ${p.perfume.name}`))
    console.log("")
  }

  let records: PerfumeCsvRecord[] = []
  let batchWarnings: string[] = []

  if (toExtract.length > 0) {
    const extractItems = toExtract.map(p => p.item)
    const enrichOnly =
      extractItems.length > 0 &&
      extractItems.every(
        i =>
          (i.openNotes?.length ?? 0) > 0 &&
          (i.heartNotes?.length ?? 0) > 0 &&
          (i.baseNotes?.length ?? 0) > 0 &&
          dbPyramidComplete(i.openNotes ?? [], i.heartNotes ?? [], i.baseNotes ?? []),
      )

    const needsPdpBootstrap = extractItems.some(
      i => Boolean(i.detailURL?.trim()) && !hasMerchantPyramidInText(i.description ?? ""),
    )

    if (isMilanoFragranzeHouse(house.name) && needsPdpBootstrap) {
      console.log(
        "Milano Fragranze: will attempt PDP note bootstrap for re-extract items (HTTP may be captcha-blocked — use browser scraper if notes stay thin).\n",
      )
    }

    console.log(`Re-extracting notes for ${extractItems.length} perfume(s)…`)
    const extracted = await extractNotesForItems(extractItems, house.name, {
      enrichOnly,
      fetchPdpNoteBootstrap: needsPdpBootstrap,
      generateNoirDescriptions: !noNoir,
      noteValidationMode: validateNotes ? "llm" : "off",
      onProgress: (message: string) => {
        console.log(`  ${message}`)
      },
    })
    records.push(...extracted.records)
    batchWarnings = extracted.batchWarnings
  }

  if (toPreserve.length > 0) {
    console.log(
      `Preserving DB notes for ${toPreserve.length} perfume(s) — stored description lacks merchant Head/Heart/Base pyramid.\n`,
    )

    const noirModel =
      process.env.OPENAI_NOTES_PIPELINE_NOIR_MODEL ??
      process.env.OPENAI_NOTES_PIPELINE_MODEL ??
      "gpt-4o-mini"
    const noirLlm =
      !noNoir && process.env.OPENAI_API_KEY
        ? new ChatOpenAI({
            model: noirModel,
            temperature: 0.9,
            apiKey: process.env.OPENAI_API_KEY,
          })
        : undefined

    const previousOpenings: string[] = []
    for (let i = 0; i < toPreserve.length; i++) {
      const p = toPreserve[i]
      if (!noNoir) {
        console.log(`  Regenerating noir for ${p.perfume.name} (notes unchanged)`)
      }
      const record = await buildPreserveRecord(
        p,
        house.name,
        noirLlm,
        noNoir,
        previousOpenings,
        i,
        toPreserve.length,
      )
      if (!noNoir) {
        previousOpenings.push(openingFingerprint(record.description))
      }
      records.push(record)
    }
  }

  records.sort((a, b) => a.name.localeCompare(b.name))

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
