/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it } from "vitest"

import { COMPARE_MAX_ITEMS, useCompareStore } from "@/hooks/compareStore"

import { PerfumeCompareToggle } from "./PerfumeCompareToggle"

const messages = {
  compare: {
    trayAriaLabel: "Tray",
    trayTitle: "Compare ({count} of {max})",
    clearAll: "Clear",
    removeItem: "Remove {name} from compare",
    toggleAdd: "Add to compare",
    toggleRemove: "Remove from compare",
    maxReached: "Compare tray is full",
  },
}

const item = {
  id: "p1",
  slug: "test-perfume",
  name: "Test Perfume",
}

function renderToggle() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PerfumeCompareToggle item={item} />
    </NextIntlClientProvider>
  )
}

function resetStore() {
  localStorage.clear()
  useCompareStore.persist.clearStorage()
  useCompareStore.setState({ items: [] })
}

describe("PerfumeCompareToggle", () => {
  beforeEach(() => {
    resetStore()
  })

  it("toggles selection without duplicate ids", () => {
    renderToggle()
    const btn = screen.getByRole("button", { name: /add to compare/i })
    expect(btn.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(btn)
    expect(
      screen.getByRole("button", { name: /remove from compare/i }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true")
    expect(useCompareStore.getState().items).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: /remove from compare/i }))
    expect(useCompareStore.getState().items).toHaveLength(0)
  })

  it("disables when tray is full and item is not selected", () => {
    const s = useCompareStore.getState()
    for (let i = 0; i < COMPARE_MAX_ITEMS; i++) {
      s.add({
        id: `other-${i}`,
        slug: `s-${i}`,
        name: `Other ${i}`,
      })
    }
    const { container } = renderToggle()
    const btn = container.querySelector('button[data-cy="button"]')
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(btn!)
    expect(useCompareStore.getState().items).toHaveLength(COMPARE_MAX_ITEMS)
    expect(useCompareStore.getState().isSelected("p1")).toBe(false)
  })
})
