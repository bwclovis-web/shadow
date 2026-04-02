import { render } from "@testing-library/react"
import { expect } from "vitest"
import { axe } from "jest-axe"
import type { ComponentType } from "react"

type AxeOptions = {
  tags?: string[]
}

export async function testAxeAccessibility<P extends object>(
  Component: ComponentType<P>,
  props: P,
  options?: AxeOptions
) {
  const { container } = render(<Component {...props} />)
  const runOpts =
    options?.tags && options.tags.length > 0
      ? { runOnly: { type: "tag" as const, values: options.tags } }
      : undefined
  const results = await axe(container, runOpts)
  expect(results).toHaveNoViolations()
}
