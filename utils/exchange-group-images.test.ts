import { describe, expect, it } from "vitest"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import {
  EXCHANGE_NEUTRAL_FALLBACK_IMAGE,
  resolveExchangeGroupImages,
} from "@/utils/exchange-group-images"

const listing = (
  overrides: Partial<ExchangeUserPerfumeRow> & Pick<ExchangeUserPerfumeRow, "id" | "userId">
): ExchangeUserPerfumeRow => ({
  available: "10",
  type: null,
  tradePreference: "cash",
  tradeOnly: false,
  price: null,
  tradePrice: null,
  images: [],
  condition: "mint",
  decantFormat: null,
  mlRemaining: null,
  user: {
    id: overrides.userId,
    firstName: "A",
    lastName: null,
    username: null,
    email: null,
  },
  ...overrides,
})

describe("resolveExchangeGroupImages", () => {
  it("uses neutral fallback when no seller or catalog image", () => {
    const resolved = resolveExchangeGroupImages({
      image: null,
      userPerfume: [],
    })
    expect(resolved.layout).toBe("simple")
    expect(resolved.main.kind).toBe("fallback")
    expect(resolved.main.src).toBe(EXCHANGE_NEUTRAL_FALLBACK_IMAGE)
    expect(resolved.sides).toHaveLength(0)
  })

  it("uses catalog when no seller photos", () => {
    const resolved = resolveExchangeGroupImages({
      image: "/images/catalog.jpg",
      userPerfume: [listing({ id: "a", userId: "u1", images: [] })],
    })
    expect(resolved.layout).toBe("simple")
    expect(resolved.main.kind).toBe("catalog")
    expect(resolved.main.src).toBe("/images/catalog.jpg")
  })

  it("uses simple layout for a single seller photo", () => {
    const resolved = resolveExchangeGroupImages({
      image: "/images/catalog.jpg",
      userPerfume: [
        listing({
          id: "a",
          userId: "u1",
          images: ["https://cdn.example.com/a.jpg"],
        }),
      ],
    })
    expect(resolved.layout).toBe("simple")
    expect(resolved.main.kind).toBe("seller")
    expect(resolved.sides).toHaveLength(0)
  })

  it("builds mosaic with main + up to 2 sides", () => {
    const resolved = resolveExchangeGroupImages({
      image: null,
      userPerfume: [
        listing({
          id: "a",
          userId: "u1",
          images: ["https://cdn.example.com/a.jpg"],
        }),
        listing({
          id: "b",
          userId: "u2",
          images: ["https://cdn.example.com/b.jpg"],
        }),
        listing({
          id: "c",
          userId: "u3",
          images: ["https://cdn.example.com/c.jpg"],
        }),
        listing({
          id: "d",
          userId: "u4",
          images: ["https://cdn.example.com/d.jpg"],
        }),
      ],
    })
    expect(resolved.layout).toBe("mosaic")
    expect(resolved.sides).toHaveLength(2)
    expect(resolved.lightboxUrls).toHaveLength(3)
  })
})
