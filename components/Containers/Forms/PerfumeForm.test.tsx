/**
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react"
import { axe } from "jest-axe"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import { FORM_TYPES } from "@/constants/general"

/** Avoid loading SearchTypeahead → next-view-transitions (breaks in Vitest without Next resolution). */
vi.mock("@/components/Organisms/TagSearch/TagSearch", () => ({
  default: () => <div data-testid="tag-search-stub" />,
}))

vi.mock("@/components/Molecules/HouseTypeahead/HouseTypeahead", () => ({
  default: ({
    label,
    name,
  }: {
    label?: string
    name: string
  }) => (
    <div>
      <label htmlFor="perfume-form-house-stub">{label ?? "House"}</label>
      <input id="perfume-form-house-stub" name={name} type="text" />
    </div>
  ),
}))

import PerfumeForm from "./PerfumeForm"

const messages: Record<string, string> = {}

const renderPerfumeForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PerfumeForm
        formType={FORM_TYPES.CREATE_PERFUME_FORM}
        lastResult={null}
        action={vi.fn()}
        hideNotes
      />
    </NextIntlClientProvider>
  )

describe("PerfumeForm accessibility", () => {
  it("has no axe violations for WCAG 2.0/2.1 A + AA (includes label / name rules)", async () => {
    const { container } = renderPerfumeForm()
    const results = await axe(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
      // jsdom has no canvas; axe’s color-contrast uses getContext and logs noise
      rules: { "color-contrast": { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })
})
