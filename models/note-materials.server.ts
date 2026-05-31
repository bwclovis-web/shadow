import { unstable_cache } from "next/cache"

import {
  buildNoteMaterialIndex,
  deriveMaterialSlugForPersistence,
  normalizeNoteName,
  type NoteMaterialIndex,
} from "@/lib/note-materials"
import { prisma } from "@/lib/db"

export const NOTE_MATERIALS_CACHE_TAG = "note-materials-index" as const

const loadNoteMaterialIndexFromDb = async (): Promise<NoteMaterialIndex> => {
  const [materials, aliases] = await Promise.all([
    prisma.noteMaterial.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.noteMaterialAlias.findMany({
      select: { materialId: true, noteId: true },
    }),
  ])
  return buildNoteMaterialIndex({ materials, aliases })
}

export const getCachedNoteMaterialIndex = unstable_cache(
  loadNoteMaterialIndexFromDb,
  ["note-materials-index"],
  { revalidate: 300, tags: [NOTE_MATERIALS_CACHE_TAG] }
)

export const getNoteMaterialIndex = (): Promise<NoteMaterialIndex> =>
  getCachedNoteMaterialIndex()

/**
 * Persist a rule-derived alias when none exists. Never overwrites manual aliases.
 */
export const persistAliasIfRuleMatches = async (
  noteId: string,
  noteName: string
): Promise<void> => {
  const slug = deriveMaterialSlugForPersistence(noteName)
  if (!slug) return

  const existing = await prisma.noteMaterialAlias.findUnique({
    where: { noteId },
    select: { source: true },
  })
  if (existing?.source === "manual") return

  const material = await prisma.noteMaterial.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!material) return

  await prisma.noteMaterialAlias.upsert({
    where: { noteId },
    create: {
      noteId,
      materialId: material.id,
      source: "rule",
    },
    update: {
      materialId: material.id,
      source: "rule",
    },
  })
}

export const findNoteByNormalizedName = async (name: string) => {
  const normalized = normalizeNoteName(name)
  if (!normalized) return null
  return prisma.perfumeNotes.findFirst({
    where: { name: normalized },
    select: { id: true, name: true },
  })
}
