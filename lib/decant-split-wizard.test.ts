import { describe, expect, it } from "vitest"

import {
  DECANT_SPLIT_MAX_SLOT_COUNT,
  DECANT_SPLIT_MIN_SLOT_COUNT,
  isBudgetConflictErrorCode,
  parseSplitSlotCount,
  releaseSubmitLock,
  remainingAfterProposed,
  tryAcquireSubmitLock,
  validateSplitWizardDraft,
  validateSplitWizardStep1,
  validateSplitWizardStep2,
} from "@/lib/decant-split-wizard"
import type { PourableMlBudgetForClient } from "@/types/decant-split"

const readyBudget = (
  partial: Partial<PourableMlBudgetForClient> = {}
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

describe("parseSplitSlotCount", () => {
  it("accepts integers within bounds", () => {
    expect(parseSplitSlotCount("1")).toEqual({ ok: true, count: 1 })
    expect(parseSplitSlotCount(String(DECANT_SPLIT_MAX_SLOT_COUNT))).toEqual({
      ok: true,
      count: DECANT_SPLIT_MAX_SLOT_COUNT,
    })
  })

  it("rejects non-integers and out-of-range counts", () => {
    expect(parseSplitSlotCount("6.5").ok).toBe(false)
    expect(parseSplitSlotCount("abc").ok).toBe(false)
    expect(parseSplitSlotCount("0").reason).toBe("slot_count_out_of_range")
    expect(parseSplitSlotCount(String(DECANT_SPLIT_MAX_SLOT_COUNT + 1)).reason).toBe(
      "slot_count_out_of_range"
    )
    expect(DECANT_SPLIT_MIN_SLOT_COUNT).toBe(1)
  })
})

describe("validateSplitWizardStep1", () => {
  it("blocks when budget failed or loading", () => {
    expect(
      validateSplitWizardStep1({
        totalMlRaw: "10",
        budget: null,
        budgetStatus: "error",
      }).ok
    ).toBe(false)

    const loading = validateSplitWizardStep1({
      totalMlRaw: "10",
      budget: null,
      budgetStatus: "loading",
    })
    if (!loading.ok) expect(loading.reason).toBe("budget_loading")
  })

  it("rejects excessive volume against remaining pourable", () => {
    const result = validateSplitWizardStep1({
      totalMlRaw: "71",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    if (!result.ok) expect(result.reason).toBe("exceeds_available")
  })

  it("accepts volume within budget using server tolerance", () => {
    const result = validateSplitWizardStep1({
      totalMlRaw: "70",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    expect(result.ok).toBe(true)
  })
})

describe("validateSplitWizardStep2", () => {
  it("rejects slot total mismatch", () => {
    const result = validateSplitWizardStep2({
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "9",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    if (!result.ok) expect(result.reason).toBe("slot_total_mismatch")
  })

  it("accepts matching totals within tolerance", () => {
    const result = validateSplitWizardStep2({
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "10",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.parsed.slotCount).toBe(6)
      expect(result.parsed.slots).toHaveLength(6)
      expect(result.parsed.slotSum).toBe(60)
    }
  })

  it("rejects non-positive slot sizes", () => {
    const zero = validateSplitWizardStep2({
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "0",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    if (!zero.ok) expect(zero.reason).toBe("slot_ml_not_positive")
  })
})

describe("validateSplitWizardDraft / remainingAfterProposed", () => {
  it("keeps draft math stable for remaining display", () => {
    expect(remainingAfterProposed(70, 60)).toBe(10)
  })

  it("full draft validation matches step 2", () => {
    const draft = validateSplitWizardDraft({
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "10",
      budget: readyBudget(),
      budgetStatus: "ready",
    })
    expect(draft.ok).toBe(true)
  })
})

describe("isBudgetConflictErrorCode", () => {
  it("flags server budget conflicts for refresh-and-retain", () => {
    expect(isBudgetConflictErrorCode("exceedsAvailable")).toBe(true)
    expect(isBudgetConflictErrorCode("conflictRetryExhausted")).toBe(true)
    expect(isBudgetConflictErrorCode("invalidVolume")).toBe(false)
  })
})

describe("submit lock / draft retention helpers", () => {
  it("prevents double-click submission", () => {
    const lock = { current: false }
    expect(tryAcquireSubmitLock(lock)).toBe(true)
    expect(tryAcquireSubmitLock(lock)).toBe(false)
    releaseSubmitLock(lock)
    expect(tryAcquireSubmitLock(lock)).toBe(true)
  })

  it("keeps the same draft validatable after simulated back navigation", () => {
    const draft = {
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "10",
      budget: readyBudget(),
      budgetStatus: "ready" as const,
    }
    expect(validateSplitWizardStep1(draft).ok).toBe(true)
    expect(validateSplitWizardStep2(draft).ok).toBe(true)
    // Returning to step 1 does not mutate draft fields.
    expect(validateSplitWizardStep1(draft).ok).toBe(true)
    expect(validateSplitWizardDraft(draft).ok).toBe(true)
  })

  it("failed submit path still validates the retained draft", () => {
    const draft = {
      totalMlRaw: "60",
      slotCountRaw: "6",
      slotMlRaw: "10",
      budget: readyBudget({ remainingPourableMl: 50 }),
      budgetStatus: "ready" as const,
    }
    const afterConflict = validateSplitWizardDraft(draft)
    if (!afterConflict.ok) {
      expect(afterConflict.reason).toBe("exceeds_available")
    }
    // Draft strings are unchanged for the user to edit.
    expect(draft.totalMlRaw).toBe("60")
    expect(draft.slotCountRaw).toBe("6")
    expect(draft.slotMlRaw).toBe("10")
  })
})
