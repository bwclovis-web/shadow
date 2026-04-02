import type { PropsWithChildren } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-view-transitions", () => ({
  useTransitionRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({
    children,
    href,
    ...rest
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/hooks/useMounted", () => ({
  useMounted: () => true,
}))

import SearchBar from "./SearchBar"

describe("SearchBar", () => {
  it("renders a combobox for search", () => {
    render(<SearchBar searchType="perfume" />)
    expect(screen.getByRole("combobox")).toBeTruthy()
  })
})
