import { afterEach, describe, expect, it, vi } from "vitest"

import { buildHouseOrganizationJsonLd, buildPerfumeProductJsonLd } from "./json-ld"

describe("buildPerfumeProductJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds Product schema with brand and image", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildPerfumeProductJsonLd({
      name: "Noir 5",
      slug: "noir-5",
      description: "A dark floral.",
      image: "https://cdn.example/bottle.png",
      perfumeHouse: { name: "Test House", slug: "test-house" },
    })

    expect(jsonLd["@type"]).toBe("Product")
    expect(jsonLd.name).toBe("Noir 5")
    expect(jsonLd.url).toBe("https://shadow.example/perfume/noir-5")
    expect(jsonLd.brand).toEqual({ "@type": "Brand", name: "Test House" })
    expect(jsonLd.image).toEqual(["https://cdn.example/bottle.png"])
  })
})

describe("buildHouseOrganizationJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds Organization schema with country and founding date", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildHouseOrganizationJsonLd({
      name: "Test House",
      slug: "test-house",
      description: "Niche perfumery.",
      country: "France",
      founded: "2010",
      website: "https://testhouse.example",
    })

    expect(jsonLd["@type"]).toBe("Organization")
    expect(jsonLd.name).toBe("Test House")
    expect(jsonLd.url).toBe("https://testhouse.example")
    expect(jsonLd.foundingDate).toBe("2010")
    expect(jsonLd.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "France",
    })
  })
})
