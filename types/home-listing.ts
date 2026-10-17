import type {
  DecantFormat,
  ListingCondition,
  PerfumeType,
  TradePreference,
} from "@prisma/client"

/** Public, viewer-independent listing shape for the homepage "Latest on the Exchange" grid. */
export type HomeListing = {
  id: string
  createdAt: Date
  images: string[]
  /** Millilitres listed for sale (`UserPerfume.available`). */
  availableMl: string
  type: PerfumeType | null
  condition: ListingCondition | null
  decantFormat: DecantFormat | null
  tradePreference: TradePreference
  tradeOnly: boolean
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    houseName: string | null
  }
  trader: {
    id: string
    displayName: string
    avatarImage: string | null
  }
}
