import { Prisma } from "@prisma/client"

const perfumeListSelect = {
  id: true,
  name: true,
  description: true,
  image: true,
  slug: true,
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
    },
  },
} satisfies Prisma.PerfumeSelect

export { perfumeListSelect }

export type PerfumeListRow = Prisma.PerfumeGetPayload<{ select: typeof perfumeListSelect }>

export interface PerfumeListPage {
  items: PerfumeListRow[]
  nextCursor: string | null
}

export const PERFUME_BY_SLUG_REVALIDATE = 3600
