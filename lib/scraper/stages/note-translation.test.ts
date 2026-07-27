import { describe, expect, it } from "vitest"

import { allNotesEnglish } from "./note-translation"

describe("allNotesEnglish", () => {
  it("accepts English pyramid notes", () => {
    expect(
      allNotesEnglish({
        openNotes: ["bergamot", "saffron"],
        heartNotes: ["rose", "patchouli"],
        baseNotes: ["oud", "cedar", "musk"],
      }),
    ).toBe(true)
  })

  it("flags Italian Rosamunda-style notes", () => {
    expect(
      allNotesEnglish({
        openNotes: ["zafferano", "foglie di rosa"],
        heartNotes: ["essenza di rosa bulgara", "assoluta di rosa turca", "patchouli"],
        baseNotes: ["oud", "cedro"],
      }),
    ).toBe(false)
  })

  it("flags Laboratorio Olfattivo Italian notes", () => {
    expect(
      allNotesEnglish({
        openNotes: ["limone italiano", "pepe rosa"],
        heartNotes: ["fiori bianchi", "gelsomino (hedione hc)", "spruzzi marini"],
        baseNotes: ["ambroxan", "sandalo", "muschi bianchi"],
      }),
    ).toBe(false)
    expect(
      allNotesEnglish({
        openNotes: ["carota"],
        heartNotes: ["rizomi di iris", "violetta"],
        baseNotes: ["legno di cedro", "ambra", "accordo daim"],
      }),
    ).toBe(false)
  })
})
