/**
 * Seed NoteMaterial parents and aliases (additive only — never deletes PerfumeNotes).
 *
 * Usage: npx tsx scripts/seed-note-materials.ts
 */

import { PrismaClient, NoteMaterialAliasSource } from "@prisma/client"
import dotenv from "dotenv"
import { join } from "path"

import { NOTE_MATERIAL_SEED } from "../lib/note-materials/seed-data"
import { deriveMaterialSlugFromNoteName, normalizeNoteName } from "../lib/note-materials/rules"

const projectRoot = join(import.meta.dirname ?? __dirname, "..")
dotenv.config({ path: join(projectRoot, ".env") })

if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL
}

const prisma = new PrismaClient()

const upsertMaterial = async (entry: (typeof NOTE_MATERIAL_SEED)[number]) => {
  return prisma.noteMaterial.upsert({
    where: { slug: entry.slug },
    create: {
      slug: entry.slug,
      name: entry.name,
      family: entry.family ?? null,
    },
    update: {
      name: entry.name,
      family: entry.family ?? null,
    },
  })
}

const upsertAliasForNote = async (
  materialId: string,
  noteId: string,
  source: NoteMaterialAliasSource
) => {
  const existing = await prisma.noteMaterialAlias.findUnique({
    where: { noteId },
    select: { source: true, materialId: true },
  })
  if (existing?.source === "manual") return "skipped-manual" as const
  await prisma.noteMaterialAlias.upsert({
    where: { noteId },
    create: { noteId, materialId, source },
    update: { materialId, source },
  })
  return "upserted" as const
}

const main = async () => {
  let aliasUpserted = 0
  let aliasSkippedNoNote = 0
  let aliasSkippedManual = 0
  let ruleAliases = 0

  const slugToMaterialId = new Map<string, string>()

  for (const entry of NOTE_MATERIAL_SEED) {
    const material = await upsertMaterial(entry)
    slugToMaterialId.set(entry.slug, material.id)

    const aliasNames = new Set<string>([
      entry.slug,
      ...(entry.aliases ?? []),
    ])

    for (const aliasName of aliasNames) {
      const normalized = normalizeNoteName(aliasName)
      const note = await prisma.perfumeNotes.findFirst({
        where: { name: normalized },
        select: { id: true },
      })
      if (!note) {
        aliasSkippedNoNote += 1
        continue
      }
      const result = await upsertAliasForNote(
        material.id,
        note.id,
        NoteMaterialAliasSource.seed
      )
      if (result === "skipped-manual") aliasSkippedManual += 1
      else aliasUpserted += 1
    }
  }

  const allNotes = await prisma.perfumeNotes.findMany({
    select: { id: true, name: true },
  })

  for (const note of allNotes) {
    const slug = deriveMaterialSlugFromNoteName(note.name)
    if (!slug) continue
    const materialId = slugToMaterialId.get(slug)
    if (!materialId) continue

    const existing = await prisma.noteMaterialAlias.findUnique({
      where: { noteId: note.id },
    })
    if (existing) continue

    const result = await upsertAliasForNote(
      materialId,
      note.id,
      NoteMaterialAliasSource.rule
    )
    if (result === "upserted") ruleAliases += 1
  }

  console.log("Note materials seed complete (non-destructive).")
  console.log(`  Materials: ${NOTE_MATERIAL_SEED.length}`)
  console.log(`  Aliases upserted (seed): ${aliasUpserted}`)
  console.log(`  Aliases added (rule pass): ${ruleAliases}`)
  console.log(`  Skipped (no matching note): ${aliasSkippedNoNote}`)
  console.log(`  Skipped (manual alias): ${aliasSkippedManual}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
