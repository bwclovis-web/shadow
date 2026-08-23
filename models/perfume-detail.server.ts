import { unstable_cache } from "next/cache"
import { cache } from "react"

import { prisma } from "@/lib/db"
import { deletePerfumeWithRelatedData } from "@/models/perfume-delete.server"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { userPerfumeNestedPerfumeSelect } from "@/models/user-perfume-listing-fields"
import { PERFUME_BY_SLUG_REVALIDATE } from "./perfume-list-fields.server"

const perfumeDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  isPending: true,
  perfumeHouseId: true,
  createdAt: true,
  updatedAt: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      country: true,
      website: true,
    },
  },
  perfumeNoteRelations: {
    select: {
      noteType: true,
      note: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const

export const getSingleUserPerfumeById = async (userPerfumeId: string, userId: string) => {
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
          comment: true,
          isPublic: true,
          createdAt: true,
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
        select: perfumeDetailSelect,
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
    select: perfumeDetailSelect,
  })

  if (!perfume) {
    return null
  }

  return transformNotesForDisplay(perfume as any)
}

export const deletePerfume = async (id: string): Promise<void> => {
  await deletePerfumeWithRelatedData(id)
}
