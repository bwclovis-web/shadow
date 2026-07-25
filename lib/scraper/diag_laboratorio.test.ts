import { describe, expect, it } from "vitest"

import { extractNotesFromStructuredText, prepareMerchantNotesSource } from "./stages/title-cleaning"

const ALAMBAR = `Ambra, Ambra e solo Ambra.
Ingredienti Ingredients: Alcohol denat., Parfum (Fragrance), Aqua (Water), Vanillin,
Hexamethylindanopyran, Citrus aurantium bergamia (Bergamot) peel oil, Limonene,
Benzyl benzoate, Linalool, Cananga odorata oil/extract.
Note Olfattive Note di testa: Bergamotto, Cacao, Ambra Note di cuore: Cannella, Vaniglia, Ambra
Note di fondo: Note ambrate Altre info Informazioni aggiuntive Formato 30ml, 100ml`

describe("Laboratorio Olfattivo Italian notes after Ingredients", () => {
  it("keeps Note di * pyramid and drops INCI", () => {
    const prepared = prepareMerchantNotesSource(ALAMBAR)
    expect(prepared.toLowerCase()).toContain("note di testa")
    expect(prepared.toLowerCase()).toContain("bergamotto")
    expect(prepared.toLowerCase()).not.toContain("alcohol denat")
    expect(prepared.toLowerCase()).not.toContain("hexamethylindanopyran")

    const notes = extractNotesFromStructuredText(prepared, 2)
    const open = notes.openNotes.map(n => n.toLowerCase())
    const heart = notes.heartNotes.map(n => n.toLowerCase())
    const base = notes.baseNotes.map(n => n.toLowerCase())
    expect(open.some(n => n.includes("bergamotto"))).toBe(true)
    expect(open.some(n => n.includes("cacao"))).toBe(true)
    expect(heart.some(n => n.includes("cannella"))).toBe(true)
    expect(heart.some(n => n.includes("vaniglia"))).toBe(true)
    expect(base.some(n => n.includes("ambrate") || n.includes("ambra"))).toBe(true)
    const all = [...open, ...heart, ...base]
    expect(all.some(n => /alcohol|linalool|ingredients/i.test(n))).toBe(false)
  })

  it("works on collapsed single-line PDP text", () => {
    const collapsed = ALAMBAR.replace(/\s+/g, " ").trim()
    const notes = extractNotesFromStructuredText(prepareMerchantNotesSource(collapsed), 2)
    expect(notes.openNotes.join(" ").toLowerCase()).toMatch(/bergamotto/)
    expect(notes.heartNotes.join(" ").toLowerCase()).toMatch(/cannella/)
  })
})
