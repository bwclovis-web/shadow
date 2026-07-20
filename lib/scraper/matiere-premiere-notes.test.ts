import { describe, it, expect } from "vitest"
import {
  extractMatierePremiereMaterialsFromPlain,
  extractMatierePremiereExtraitMaterialsFromPlain,
  extractMerchantNoteBootstrapFromHtml,
} from "@/lib/scraper/stages/pdp-bootstrap"

describe("matiere premiere notes", () => {
  const falconPlain = `INITIAL IDEA: "Create a leathery scent inspired by falconers' gloves"
MAIN INGREDIENT: A vegetal leather note, Birch Tar Finland.
CREATIVE APPROACH: Exacerbate the power of the note at the start thanks to Saffron. Unfold and enrich the texture of Birch Tar to evoke both sides of leather: highlight the smooth full-grain side with Ciste Labdanum Andalusia, amplify the soft suede side with Benzoin Absolute Laos.
Available sizes: Eau de parfum 100ml spray`

  const vanillaPlain = `INITIAL IDEA: « A contrast between a dark vanilla and a white Palo Santo wood »
MAIN INGREDIENT: Vanilla Absolute Madagascar, Fair for Life agricultural programme
CREATIVE APPROACH: Palo Santo Oil Ecuador brings structure and verticality. The addictive character of Vanilla is reinforced by Coconut powder. White Musks envelop the Vanilla and powders for a contemporary, luminous perfume.
Available sizes: Eau de parfum 100ml spray`

  const saffronPlain = `INITIAL IDEA: "The comfortable brightness of saffron"
MAIN INGREDIENT: Saffron Oil Greece.
CREATIVE APPROACH: Habanolide Musk amplifies the contemporary, genderless character and aura of saffron. Ambroxan underlines its comfortable, almost addictive facet. Incense Oil Somalia both accentuates the vibrancy and projection of saffron, and brings texture to the fragrance.
Available sizes: Eau de parfum 100ml spray`

  const extraitPlain = `Vanilla Powder is a distinctive take on vanilla, born from the contrast between the deep intensity of Vanilla Absolute from Madagascar and an overdose of modern white powders. To create the Extrait, Founder and Perfumer Aurélien Guichard selected an exceptional guest ingredient: Tonka Bean Absolute Venezuela.`

  it("extracts Falcon Leather CREATIVE APPROACH materials", () => {
    const materials = extractMatierePremiereMaterialsFromPlain(falconPlain)
    expect(materials).toEqual(
      expect.arrayContaining([
        "birch tar finland",
        "saffron",
        "birch tar",
        "ciste labdanum andalusia",
        "benzoin absolute laos",
      ]),
    )
  })

  it("extracts Vanilla Powder materials (not Fair for Life programme text)", () => {
    const materials = extractMatierePremiereMaterialsFromPlain(vanillaPlain)
    expect(materials).toEqual(
      expect.arrayContaining([
        "vanilla absolute madagascar",
        "palo santo oil ecuador",
        "coconut powder",
        "white musk",
      ]),
    )
    expect(materials).not.toContain("fair for life agricultural programme")
  })

  it("extracts Crystal Saffron materials including saffron oil", () => {
    const materials = extractMatierePremiereMaterialsFromPlain(saffronPlain)
    expect(materials).toEqual(
      expect.arrayContaining([
        "saffron oil greece",
        "habanolide musk",
        "ambroxan",
        "incense oil somalia",
      ]),
    )
  })

  it("extracts Extrait guest ingredient prose", () => {
    const materials = extractMatierePremiereExtraitMaterialsFromPlain(extraitPlain)
    expect(materials).toEqual(
      expect.arrayContaining(["vanilla absolute madagascar", "tonka bean absolute venezuela"]),
    )
  })

  it("extracts from HTML body", () => {
    const html = `<html><body><div>${falconPlain}</div></body></html>`
    const chunk = extractMerchantNoteBootstrapFromHtml(html)
    expect(chunk).toMatch(/fragrance notes:/i)
    expect(chunk?.toLowerCase()).toContain("saffron")
    expect(chunk?.toLowerCase()).toContain("benzoin absolute laos")
  })
})
