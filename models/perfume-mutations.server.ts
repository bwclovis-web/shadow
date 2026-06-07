import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"
import { migratePerfumeImageToR2 } from "@/lib/r2-migrate"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { sanitizeText } from "@/utils/server/sanitize.server"
import { createUrlSlug } from "@/utils/slug"

type CreatePendingPerfumePlaceholderInput = {
  name: string
  description: string
  houseId: string
  submittedBy: string
  pendingSubmissionId?: string
  image?: string
}

export const createPendingPerfumePlaceholder = async (
  input: CreatePendingPerfumePlaceholderInput
) => {
  const name = sanitizeText(input.name)
  const description = sanitizeText(input.description)
  const image = input.image?.trim() || null

  const created = await prisma.$transaction(async tx => {
    const existing = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: input.houseId,
        submittedBy: input.submittedBy,
      },
    })

    if (existing) {
      return existing
    }

    const house = await tx.perfumeHouse.findUnique({
      where: { id: input.houseId },
      select: { name: true },
    })
    const houseName = house?.name?.trim() ?? ""
    const slugBase = `${createUrlSlug(name)}-${createUrlSlug(houseName || "house")}-pending`
    const slug = await findUniqueSlug(tx, slugBase)

    return tx.perfume.create({
      data: {
        name,
        slug,
        description,
        image: image ?? undefined,
        perfumeHouseId: input.houseId,
        isPending: true,
        submittedBy: input.submittedBy,
        pendingSubmissionId: input.pendingSubmissionId ?? null,
      },
    })
  })

  return created
}

export const updatePerfume = async (id: string, data: FormData) => {
  try {
    const name = sanitizeText(data.get("name") as string)

    // Capture old image URL before overwriting, so we can clean up R2 if it changes.
    const existing = await prisma.perfume.findUnique({
      where: { id },
      select: { image: true },
    })
    const oldImageUrl = existing?.image ?? null

    // Extract notes from FormData
    const topNotes = data.getAll("notesTop") as string[]
    const heartNotes = data.getAll("notesHeart") as string[]
    const baseNotes = data.getAll("notesBase") as string[]

    // Use transaction to update perfume and note relations
    const updatedPerfume = await prisma.$transaction(async tx => {
      // Update perfume basic info
      const perfume = await tx.perfume.update({
        where: { id },
        data: {
          name,
          slug: createUrlSlug(name),
          description: sanitizeText(data.get("description") as string),
          image: data.get("image") as string,
          perfumeHouse: {
            connect: {
              id: data.get("house") as string,
            },
          },
        },
      })

      // Delete existing note relations
      await tx.perfumeNoteRelation.deleteMany({
        where: { perfumeId: id },
      })

      // Create new note relations in junction table
      const relationsToCreate = [
        ...topNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "open" as const,
        })),
        ...heartNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "heart" as const,
        })),
        ...baseNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "base" as const,
        })),
      ]

      if (relationsToCreate.length > 0) {
        await tx.perfumeNoteRelation.createMany({
          data: relationsToCreate,
          skipDuplicates: true,
        })
      }

      return perfume
    })

    const imageUrl = (data.get("image") as string)?.trim()

    // Delete the old R2 object if the image URL changed and the old one was stored in R2.
    if (oldImageUrl && imageUrl !== oldImageUrl) {
      const oldKey = getR2KeyFromPublicUrl(oldImageUrl)
      if (oldKey) {
        try {
          await deleteFromR2(oldKey)
        } catch (err) {
          console.error("[updatePerfume] Failed to delete old image from R2:", oldKey, err)
          // Non-fatal: continue with update; orphaned object can be cleaned up later.
        }
      }
    }

    if (imageUrl) {
      await migratePerfumeImageToR2(id, imageUrl, { prismaClient: prisma })
      const refreshed = await prisma.perfume.findUnique({
        where: { id },
        include: {
          perfumeHouse: true,
          perfumeNoteRelations: { include: { note: true } },
        },
      })
      if (refreshed) {
        return { success: true, data: transformNotesForDisplay(refreshed as any) }
      }
    }
    return { success: true, data: updatedPerfume }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false, error: "Perfume already exists" }
    }
    throw err
  }
}

const findUniqueSlug = async (
  tx: Prisma.TransactionClient,
  baseSlug: string
): Promise<string> => {
  if (!baseSlug) return baseSlug
  let slug = baseSlug
  let n = 2
  while (await tx.perfume.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n}`
    n += 1
  }
  return slug
}

export const createPerfume = async (data: FormData) => {
  const name = sanitizeText(data.get("name") as string)
  const description = sanitizeText(data.get("description") as string)
  const image = data.get("image") as string
  const houseId = data.get("house") as string

  // Use transaction to create perfume and note relations
  const newPerfume = await prisma.$transaction(async tx => {
    const house = await tx.perfumeHouse.findUnique({
      where: { id: houseId },
      select: { name: true },
    })
    const houseName = house?.name?.trim() ?? ""

    const existing = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: houseId,
      },
    })
    if (existing) {
      throw new Error(
        "A perfume with this name already exists for this house. Please choose a different name."
      )
    }

    const existingInOtherHouse = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: { not: houseId },
      },
      select: { id: true },
    })

    const finalName =
      existingInOtherHouse && houseName ? `${name} - ${houseName}` : name

    const nameSlug = createUrlSlug(finalName)
    const existingSlug = await tx.perfume.findUnique({
      where: { slug: nameSlug },
      select: { id: true },
    })

    let slugBase = nameSlug
    if (existingSlug) {
      const houseSlug = houseName ? createUrlSlug(houseName) : ""
      if (houseSlug) {
        slugBase = `${nameSlug}-${houseSlug}`
      }
    }

    const slug = await findUniqueSlug(tx, slugBase)

    // Create perfume
    const perfume = await tx.perfume.create({
      data: {
        name: finalName,
        slug,
        description,
        image,
        perfumeHouse: {
          connect: { id: houseId },
        },
      },
    })

    // Create note relations in junction table
    const topNotes = data.getAll("notesTop") as string[]
    const heartNotes = data.getAll("notesHeart") as string[]
    const baseNotes = data.getAll("notesBase") as string[]

    const relationsToCreate = [
      ...topNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "open" as const,
      })),
      ...heartNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "heart" as const,
      })),
      ...baseNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "base" as const,
      })),
    ]

    if (relationsToCreate.length > 0) {
      await tx.perfumeNoteRelation.createMany({
        data: relationsToCreate,
        skipDuplicates: true,
      })
    }

    return perfume
  })

  const imageUrl = (data.get("image") as string)?.trim()
  if (imageUrl) {
    await migratePerfumeImageToR2(newPerfume.id, imageUrl, { prismaClient: prisma })
  }
  return newPerfume
}
