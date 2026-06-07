import { unstable_cache } from "next/cache"
import { cache } from "react"

import { prisma } from "@/lib/db"
import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"
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

export const deletePerfume = async (id: string) => {
  const perfume = await prisma.perfume.findUnique({
    where: { id },
    select: { image: true },
  })
  if (perfume?.image) {
    const r2Key = getR2KeyFromPublicUrl(perfume.image)
    if (r2Key) {
      try {
        await deleteFromR2(r2Key)
      } catch (err) {
        console.error("[deletePerfume] Failed to delete image from R2:", r2Key, err)
        // Continue with DB delete; orphaned R2 object can be cleaned up later
      }
    }
  }
  const deleted = await prisma.perfume.delete({
    where: { id },
  })
  return deleted
}
