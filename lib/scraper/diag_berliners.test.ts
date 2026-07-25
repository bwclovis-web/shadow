import { describe, expect, it } from "vitest"

import { extractNotesFromStructuredText, prepareMerchantNotesSource } from "./stages/title-cleaning"

const BERLINERS = `Berliners – German doughnuts filled with sticky raspberry jelly served straight from the fryer.

Notes: Complex fruity raspberry mingling with the essence of rich vanilla extract on a bed of warm, yeasty, fried dough.

Ingredients: Alcohol (Denat.), Fragrance (Parfum), Water (Aqua), Benzyl Cinnamate, Geraniol, Beta Caryophyllene, Benzyl Alcohol, Citronellol, Citral, Terpineol, Linalool, Alpha Pinene, Alpha Terpinene, Eugenol, Limonene, Terpinolene, Vanillin, Benzaldehyde.`

describe("Damask Berliners ingredients bleed", () => {
  it("keeps narrative materials and drops the Ingredients / INCI block", () => {
    const prepared = prepareMerchantNotesSource(BERLINERS)
    expect(prepared.toLowerCase()).not.toContain("ingredients:")
    const notes = extractNotesFromStructuredText(prepared, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes].map(n =>
      n.toLowerCase(),
    )
    expect(all.join(" ")).toMatch(/raspberry/)
    expect(all.join(" ")).toMatch(/vanilla/)
    expect(all.some(n => /alcohol|parfum|aqua|benzyl|linalool|geraniol|ingredients/i.test(n))).toBe(
      false,
    )
  })

  it("collapsed single-line PDP also drops Ingredients", () => {
    const collapsed = BERLINERS.replace(/\s+/g, " ").trim()
    const notes = extractNotesFromStructuredText(collapsed, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes].map(n =>
      n.toLowerCase(),
    )
    expect(all.join(" ")).toMatch(/raspberry|vanilla|fried dough|yeasty/)
    expect(all.some(n => /alcohol|benzyl cinnamate|linalool|ingredients:/i.test(n))).toBe(false)
  })
})
