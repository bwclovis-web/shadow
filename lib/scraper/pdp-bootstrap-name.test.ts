import { describe, expect, it } from "vitest"

import {
  isLikelyReviewWidgetTitle,
  resolveProductName,
} from "@/lib/scraper/stages/pdp-bootstrap"

describe("resolveProductName", () => {
  it("keeps accented merchant title even when URL slug is longer ASCII", () => {
    expect(
      resolveProductName({
        name: "Cédrat Intense",
        detailURL: "https://example.com/products/cedrat-intense-eau-de-parfum",
      }),
    ).toBe("Cédrat Intense")
  })

  it("keeps accented title when URL would produce different casing/ASCII", () => {
    expect(
      resolveProductName({
        name: "Crème Ebène",
        detailURL: "https://shop.example.com/p/creme-ebene",
      }),
    ).toBe("Crème Ebène")
  })

  it("falls back to URL-derived name when scraped name is empty", () => {
    expect(
      resolveProductName({
        name: "",
        detailURL: "https://example.com/products/lord-of-misrule-perfume",
      }),
    ).toBe("Lord Of Misrule Perfume")
  })

  it("falls back to URL-derived name when scraped name looks like a hostname", () => {
    expect(
      resolveProductName({
        name: "Www.lush.com",
        detailURL: "https://www.lush.com/products/lord-of-misrule-perfume",
      }),
    ).toBe("Lord Of Misrule Perfume")
  })

  it("upgrades truncated ASCII title from URL slug (Etsy-style)", () => {
    expect(
      resolveProductName({
        name: "Burner Perfume No",
        detailURL:
          "https://www.etsy.com/listing/123/burner-perfume-no9b-handcrafted-fragrance",
      }),
    ).toBe("Burner Perfume No. 9B Handcrafted Fragrance")
  })

  it("keeps non-empty non-hostname title as-is", () => {
    expect(
      resolveProductName({
        name: "New York Intense",
        detailURL: "https://example.com/products/new-york-intense",
      }),
    ).toBe("New York Intense")
  })

  it("falls back to URL slug when the title is a reviews widget dump", () => {
    expect(
      isLikelyReviewWidgetTitle(
        "Customer Reviews Based On Reviews Write A Review % % % % % S Sophia Lewandowski",
      ),
    ).toBe(true)
    expect(
      resolveProductName({
        name: "Customer Reviews Based On Reviews Write A Review % % % % % S Sophia Lewandowski Smells Just As Advertised",
        detailURL: "https://www.mochiglow.com/products/perfume-cereal-milk",
      }),
    ).toBe("Perfume Cereal Milk")
  })
})
