import { describe, expect, it } from "vitest"

import type { ExchangeFragranceGroupDto } from "@/types/exchange-discovery"
import {
  exchangeGroupToCardSource,
  exchangeGroupToPageRow,
} from "@/utils/exchange-group-card"

const group = (overrides?: Partial<ExchangeFragranceGroupDto>): ExchangeFragranceGroupDto => ({
  id: "perfume1perfume1perfume1per",
  name: "Test Rose",
  slug: "test-rose",
  image: "/catalog.jpg",
  perfumeHouse: { id: "house1house1house1house1hou", name: "House", slug: "house" },
  offerCount: 4,
  collectorCount: 2,
  previews: [
    {
      userPerfumeId: "up1up1up1up1up1up1up1up1up",
      userId: "user1user1user1user1user1",
      url: "https://cdn.example.com/a.jpg",
      traderName: "Ada",
      condition: "mint",
      tradePreference: "both",
      tradeOnly: false,
      user: {
        id: "user1user1user1user1user1",
        firstName: "Ada",
        lastName: null,
        username: null,
        email: null,
      },
    },
  ],
  ...overrides,
})

describe("exchangeGroupToCardSource", () => {
  it("maps previews into card userPerfume images", () => {
    const card = exchangeGroupToCardSource(group())
    expect(card.userPerfume).toHaveLength(1)
    expect(card.userPerfume[0]?.images).toEqual([
      "https://cdn.example.com/a.jpg",
    ])
    expect(card.perfumeHouse?.name).toBe("House")
  })
})

describe("exchangeGroupToPageRow", () => {
  it("preserves offer and collector counts separately", () => {
    const row = exchangeGroupToPageRow(group())
    expect(row.offerCount).toBe(4)
    expect(row.collectorCount).toBe(2)
    expect(row.userPerfume).toHaveLength(1)
  })
})
