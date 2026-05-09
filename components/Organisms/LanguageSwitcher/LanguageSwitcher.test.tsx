import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import messages from "../../../messages/en.json"

import LanguageSwitcher from "./LanguageSwitcher"

const { mockRefresh, mockSetLocale } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSetLocale: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: mockRefresh,
  }),
}))

vi.mock("@/lib/actions/locale", () => ({
  setLocale: (locale: string) => mockSetLocale(locale),
}))

const renderSwitcher = (locale = "en") =>
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>
  )

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetLocale.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders the language switcher", () => {
      renderSwitcher()
      expect(screen.getByRole("combobox", { name: /select language/i })).toBeInTheDocument()
    })

    it("renders all language options", () => {
      renderSwitcher()
      expect(screen.getAllByRole("option")).toHaveLength(4)
    })

    it("renders English and Spanish options", () => {
      renderSwitcher()
      expect(screen.getByRole("option", { name: /english/i })).toBeInTheDocument()
      expect(screen.getByRole("option", { name: /español/i })).toBeInTheDocument()
    })
  })

  describe("Default Selection", () => {
    it("defaults to English when locale is en", () => {
      renderSwitcher("en")
      const select = screen.getByRole("combobox") as HTMLSelectElement
      expect(select.value).toBe("en")
    })

    it("defaults to Spanish when locale is es", () => {
      renderSwitcher("es")
      const select = screen.getByRole("combobox") as HTMLSelectElement
      expect(select.value).toBe("es")
    })
  })

  describe("Language Change", () => {
    it("calls setLocale and router.refresh when selecting a language", async () => {
      const user = userEvent.setup()
      renderSwitcher("en")

      const select = screen.getByRole("combobox")
      await user.selectOptions(select, "es")

      await waitFor(() => {
        expect(mockSetLocale).toHaveBeenCalledWith("es")
      })
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it("handles language change via fireEvent", async () => {
      renderSwitcher("en")
      const select = screen.getByRole("combobox")
      fireEvent.change(select, { target: { value: "fr" } })

      await waitFor(() => {
        expect(mockSetLocale).toHaveBeenCalledWith("fr")
      })
    })
  })

  describe("Select integration", () => {
    it("has correct select id", () => {
      renderSwitcher()
      expect(screen.getByRole("combobox")).toHaveAttribute("id", "language-switcher")
    })

    it("option values match locale codes", () => {
      renderSwitcher()
      const options = screen.getAllByRole("option") as HTMLOptionElement[]
      expect(options.map((o) => o.value)).toEqual(["en", "es", "fr", "it"])
    })
  })

  describe("Edge cases", () => {
    it("renders with French as current locale", () => {
      renderSwitcher("fr")
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })
  })
})
