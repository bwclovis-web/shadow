import type { DecantFormat, ListingCondition } from "@prisma/client"

export type UserPerfumeForClient = {
  id: string
  userId: string
  perfumeId: string
  amount: string
  available: string | null
  pausedAvailable?: string | null
  price: string | null
  placeOfPurchase: string | null
  tradePrice: string | null
  tradePreference: string | null
  tradeOnly: boolean | null
  type: string | null
  createdAt: string
  images?: string[]
  condition?: ListingCondition | null
  decantFormat?: DecantFormat | null
  mlRemaining?: number | null
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    description: string | null
    perfumeHouse: {
      id: string
      name: string
      slug: string
    } | null
  }
  _count: { comments: number }
}

export type MyScentsView = "inventory" | "listings"
