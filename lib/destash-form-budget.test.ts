import { describe, expect, it } from "vitest"

import {
  computeFormMaxAvailableMl,
  validateDestashAmountAgainstBudget,
} from "@/lib/destash-form-budget"
import type { PourableMlBudgetForClient } from "@/types/decant-split"

const readyBudget = (
  partial: Partial<PourableMlBudgetForClient>
): PourableMlBudgetForClient => ({
  ownedMl: 100,
  listedMl: 20,
  reservedMl: 10,
  consumedCompletedMl: 0,
  remainingPourableMl: 70,
  ownership: "known",
  mayAllocate: true,
  ...partial,
})

describe("computeFormMaxAvailableMl", () => {
  it("uses remaining pourable and credits the listing being edited", () => {
    expect(
      computeFormMaxAvailableMl({
        budget: readyBudget({ remainingPourableMl: 70 }),
        isEditing: false,
        currentListedMl: 0,
      })
    ).toBe(70)

    expect(
      computeFormMaxAvailableMl({
        budget: readyBudget({ remainingPourableMl: 70 }),
        isEditing: true,
        currentListedMl: 20,
      })
    ).toBe(90)
  })

  it("does not invent a 100 ml fallback when budget is missing or unknown", () => {
    expect(
      computeFormMaxAvailableMl({
        budget: null,
        isEditing: false,
        currentListedMl: 0,
      })
    ).toBeNull()

    expect(
      computeFormMaxAvailableMl({
        budget: readyBudget({
          ownership: "unknown",
          mayAllocate: false,
          remainingPourableMl: 0,
        }),
        isEditing: false,
        currentListedMl: 0,
      })
    ).toBeNull()
  })

  it("allows edit shrink-only when ownership is unknown", () => {
    expect(
      computeFormMaxAvailableMl({
        budget: readyBudget({
          ownership: "unknown",
          mayAllocate: false,
          remainingPourableMl: 0,
        }),
        isEditing: true,
        currentListedMl: 15,
      })
    ).toBe(15)
  })
})

describe("validateDestashAmountAgainstBudget", () => {
  it("requires positive volume for creation", () => {
    const result = validateDestashAmountAgainstBudget({
      amountRaw: "0",
      maxAvailableMl: 50,
      budgetStatus: "ready",
      isCreating: true,
      requirePositiveForCreate: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("positive_required")
  })

  it("rejects amounts above the authoritative max", () => {
    const result = validateDestashAmountAgainstBudget({
      amountRaw: "50.1",
      maxAvailableMl: 50,
      budgetStatus: "ready",
      isCreating: true,
      requirePositiveForCreate: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("exceeds_available")
  })

  it("accepts a volume within tolerance of the max", () => {
    const result = validateDestashAmountAgainstBudget({
      amountRaw: "50",
      maxAvailableMl: 50,
      budgetStatus: "ready",
      isCreating: true,
      requirePositiveForCreate: true,
    })
    expect(result).toEqual({ ok: true, ml: 50 })
  })

  it("blocks positive create when budget failed", () => {
    const result = validateDestashAmountAgainstBudget({
      amountRaw: "10",
      maxAvailableMl: null,
      budgetStatus: "error",
      isCreating: true,
      requirePositiveForCreate: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("budget_error")
  })
})
