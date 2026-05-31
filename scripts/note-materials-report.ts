/**
 * Read-only report: unmapped displayable notes, collisions, coverage.
 *
 * Usage: npx tsx scripts/note-materials-report.ts
 */

import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import { join } from "path"
import { writeFileSync, mkdirSync, existsSync } from "fs"

import { buildNoteMaterialIndex, resolveNoteToMaterialId } from "../lib/note-materials/resolve"
import { isDisplayableScentNote } from "../utils/validation/note-validation.server"

const projectRoot = join(import.meta.dirname ?? __dirname, "..")
dotenv.config({ path: join(projectRoot, ".env") })

if (process.env.NODE_ENV !== "production" && process.env.LOCAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL
}

const prisma = new PrismaClient()

const main = async () => {
  const [materials, aliases, notes] = await Promise.all([
    prisma.noteMaterial.findMany({ select: { id: true, slug: true, name: true } }),
    prisma.noteMaterialAlias.findMany({ select: { materialId: true, noteId: true } }),
    prisma.perfumeNotes.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { perfumeNoteRelations: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const index = buildNoteMaterialIndex({ materials, aliases })
  const displayable = notes.filter((n) => isDisplayableScentNote(n.name))

  const unmapped: { name: string; relationCount: number }[] = []
  const mapped: { name: string; material: string; relationCount: number }[] = []

  for (const note of displayable) {
    const materialId = resolveNoteToMaterialId(index, {
      noteId: note.id,
      noteName: note.name,
    })
    if (!materialId) {
      unmapped.push({
        name: note.name,
        relationCount: note._count.perfumeNoteRelations,
      })
    } else {
      const mat = index.materialById.get(materialId)
      mapped.push({
        name: note.name,
        material: mat?.name ?? materialId,
        relationCount: note._count.perfumeNoteRelations,
      })
    }
  }

  unmapped.sort((a, b) => b.relationCount - a.relationCount)

  const lines = [
    "# Note materials report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Materials in DB: ${materials.length}`,
    `- DB aliases: ${aliases.length}`,
    `- Displayable notes: ${displayable.length}`,
    `- Mapped (DB or rules): ${mapped.length}`,
    `- Unmapped: ${unmapped.length}`,
    "",
    "## Top unmapped by perfume usage",
    "",
    ...unmapped.slice(0, 80).map(
      (u) => `- ${u.name} (${u.relationCount} perfumes)`
    ),
  ]

  const report = lines.join("\n")
  console.log(report)

  const reportsDir = join(projectRoot, "reports")
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
  const path = join(
    reportsDir,
    `note-materials-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`
  )
  writeFileSync(path, report, "utf-8")
  console.log(`\nSaved: ${path}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
