/** Shared Prisma select fields for listing quality (1D). */
export const userPerfumeListingSelect = {
  images: true,
  condition: true,
  decantFormat: true,
  mlRemaining: true,
} as const

/** Nested perfume fields returned with user collection rows. */
export const userPerfumeNestedPerfumeSelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  description: true,
  isPending: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const
