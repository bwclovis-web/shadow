import { unstable_cache } from "next/cache"
import { cache } from "react"

import { prisma } from "@/lib/db"
import { deletePerfumeWithRelatedData } from "@/models/perfume-delete.server"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { userPerfumeNestedPerfumeSelect } from "@/models/user-perfume-listing-fields"
import { PERFUME_BY_SLUG_REVALIDATE } from "./perfume-list-fields.server"

export const getSingleUserPerfumeById = async (userPerfumeId: string, userId: string) => {
  // Query by the actual userPerfume.id to get the specific destash entry
  const userPerfume = await prisma.userPerfume.findFirst({
  where: { id: userPerfumeId, userId },
  select: {
    id: true,
    perfumeId: true,
    userId: true,
    amount: true,
    available: true,
    type: true,
    comments: {
      select: {
        id: true,
        userId: true,
        perfumeId: true,
        userPerfumeId: true,
        comment: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    },
    price: true,
    perfume: { 
      select: userPerfumeNestedPerfumeSelect,
    },
    },
  })
  return userPerfume
}

export const getPerfumeBySlug = cache(async (slug: string) => {
  return unstable_cache(
    async () => {
      const perfume = await prisma.perfume.findUnique({
        where: { slug },
        include: {
          perfumeHouse: true,
          perfumeNoteRelations: {
            include: {
              note: true,
            },
          },
        },
      })
      if (!perfume) return null
      return transformNotesForDisplay(perfume as any)
    },
    ["perfume-by-slug", slug],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume", `perfume-${slug}`] }
  )()
})

export const getPerfumeById = async (id: string) => {
  const perfume = await prisma.perfume.findUnique({
    where: { id },
    include: {
      perfumeHouse: true,
      // Use junction table for notes
      perfumeNoteRelations: {
        include: {
          note: true,
        },
      },
    },
  })
  
  if (!perfume) {
    return null
  }
  
  // Transform to backward-compatible format
  return transformNotesForDisplay(perfume as any)
}

export const deletePerfume = async (id: string): Promise<void> => {
  await deletePerfumeWithRelatedData(id)
}
