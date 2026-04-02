import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"

import messages from "../../messages/en.json"

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper">

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  renderOptions: RenderWithProvidersOptions = {}
) {
  return render(ui, {
    wrapper: ({ children }) => <AllProviders>{children}</AllProviders>,
    ...renderOptions,
  })
}
