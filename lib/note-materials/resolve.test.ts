import { describe, expect, it } from "vitest"

import {
  buildMaterialPreferenceWeights,
  buildNoteMaterialIndex,
  scorePerfumeNotesByMaterial,
} from "./resolve"

const index = buildNoteMaterialIndex({
  materials: [
    { id: "mat-bergamot", slug: "bergamot", name: "Bergamot" },
    { id: "mat-rose", slug: "rose", name: "Rose" },
  ],
  aliases: [{ materialId: "mat-bergamot", noteId: "note-italian-berg" }],
})

describe("scorePerfumeNotesByMaterial", () => {
  it("scores alias note via runtime rule when not in DB", () => {
    const noteNames = new Map([
      ["note-italian-berg", "italian bergamot"],
      ["note-rose", "rose"],
    ])
    const weights = new Map([["mat-bergamot", 1]])
    const { score, contribByMaterialId } = scorePerfumeNotesByMaterial(
      index,
      ["note-italian-berg"],
      noteNames,
      weights
    )
    expect(score).toBe(1)
    expect(contribByMaterialId["mat-bergamot"]).toBe(1)
  })

  it("counts each material once per perfume", () => {
    const noteNames = new Map([
      ["n1", "bergamot"],
      ["n2", "italian bergamot"],
    ])
    const weights = new Map([["mat-bergamot", 2]])
    const { score } = scorePerfumeNotesByMaterial(
      index,
      ["n1", "n2"],
      noteNames,
      weights
    )
    expect(score).toBe(2)
  })
})

describe("buildMaterialPreferenceWeights", () => {
  it("merges materialWeights and legacy noteWeights", () => {
    const noteNames = new Map([["note-rose", "rose"]])
    const weights = buildMaterialPreferenceWeights(index, {
      materialWeights: { "mat-bergamot": 1 },
      noteWeights: { "note-rose": 1 },
      noteNamesById: noteNames,
    })
    expect(weights.get("mat-bergamot")).toBe(1)
    expect(weights.get("mat-rose")).toBe(1)
  })
})
