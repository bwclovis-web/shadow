import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildBreadcrumbListJsonLd,
  buildFaqPageJsonLd,
  buildHouseOrganizationJsonLd,
  buildItemListJsonLd,
  buildPerfumeProductJsonLd,
  buildSiteOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "./json-ld"

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
    expect(jsonLd.brand).toEqual({
      "@type": "Brand",
      name: "Test House",
      url: "https://shadow.example/houses/test-house",
    })
    expect(jsonLd.image).toEqual(["https://cdn.example/bottle.png"])
    expect(jsonLd.aggregateRating).toBeUndefined()
  })

  it("adds note layers as additionalProperty", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildPerfumeProductJsonLd({
      name: "Garden Warfare",
      slug: "garden-warfare",
      openNotes: [{ name: "tomato leaf" }, { name: "basil" }],
      heartNotes: ["lavender"],
      baseNotes: [{ name: "cedarwood" }],
    })

    expect(jsonLd.additionalProperty).toEqual([
      {
        "@type": "PropertyValue",
        name: "Top notes",
        value: "tomato leaf, basil",
      },
      {
        "@type": "PropertyValue",
        name: "Heart notes",
        value: "lavender",
      },
      {
        "@type": "PropertyValue",
        name: "Base notes",
        value: "cedarwood",
      },
    ])
  })

  it("adds aggregateRating when ratingCount >= 1", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildPerfumeProductJsonLd({
      name: "Noir 5",
      slug: "noir-5",
      aggregateRating: { ratingValue: 4.2, ratingCount: 3 },
    })

    expect(jsonLd.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.2,
      ratingCount: 3,
      bestRating: 5,
      worstRating: 1,
    })
  })

  it("omits aggregateRating when ratingCount is 0", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildPerfumeProductJsonLd({
      name: "Noir 5",
      slug: "noir-5",
      aggregateRating: { ratingValue: 0, ratingCount: 0 },
    })

    expect(jsonLd.aggregateRating).toBeUndefined()
  })

  it("adds review nodes with optional rating", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildPerfumeProductJsonLd({
      name: "Noir 5",
      slug: "noir-5",
      reviews: [
        {
          author: "Ada",
          reviewBody: "Velvet woods.",
          datePublished: "2026-01-02T00:00:00.000Z",
          ratingValue: 5,
        },
        {
          author: "Bea",
          reviewBody: "Soft musk.",
        },
      ],
    })

    expect(jsonLd.review).toEqual([
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Ada" },
        reviewBody: "Velvet woods.",
        datePublished: "2026-01-02T00:00:00.000Z",
        reviewRating: {
          "@type": "Rating",
          ratingValue: 5,
          bestRating: 5,
          worstRating: 1,
        },
      },
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Bea" },
        reviewBody: "Soft musk.",
      },
    ])
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

describe("buildBreadcrumbListJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds BreadcrumbList with absolute item URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildBreadcrumbListJsonLd([
      { name: "Home", path: "/" },
      { name: "Houses", path: "/houses" },
      { name: "Test House", path: "/houses/test-house" },
    ])

    expect(jsonLd["@type"]).toBe("BreadcrumbList")
    expect(jsonLd.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://shadow.example/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Houses",
        item: "https://shadow.example/houses",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Test House",
        item: "https://shadow.example/houses/test-house",
      },
    ])
  })
})

describe("buildSiteOrganizationJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds site Organization with logo and contact email", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildSiteOrganizationJsonLd()
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "perfumer's hollow",
      url: "https://shadow.example/",
      logo: "https://shadow.example/images/new/logo-one.webp",
      email: "contact@shadowandsillage.com",
    })
  })
})

describe("buildWebSiteJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds WebSite with SearchAction to the exchange", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildWebSiteJsonLd()
    expect(jsonLd["@type"]).toBe("WebSite")
    expect(jsonLd.potentialAction).toEqual({
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://shadow.example/the-exchange?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    })
  })
})

describe("buildFaqPageJsonLd", () => {
  it("builds FAQPage from Q/A pairs", () => {
    const jsonLd = buildFaqPageJsonLd([
      { question: "How do I trade?", answer: "List a decant on The Exchange." },
      { question: "  ", answer: "ignored" },
    ])

    expect(jsonLd["@type"]).toBe("FAQPage")
    expect(jsonLd.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "How do I trade?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "List a decant on The Exchange.",
        },
      },
    ])
  })
})

describe("buildItemListJsonLd", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds ItemList with absolute item URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example")

    const jsonLd = buildItemListJsonLd({
      name: "Perfumes starting with A",
      path: "/the-archive/A",
      items: [
        { name: "Ambre", path: "/perfume/ambre" },
        { name: "Atlas", path: "/perfume/atlas" },
      ],
    })

    expect(jsonLd["@type"]).toBe("ItemList")
    expect(jsonLd.numberOfItems).toBe(2)
    expect(jsonLd.url).toBe("https://shadow.example/the-archive/A")
    expect(jsonLd.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Ambre",
        url: "https://shadow.example/perfume/ambre",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Atlas",
        url: "https://shadow.example/perfume/atlas",
      },
    ])
  })
})
