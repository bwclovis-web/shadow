/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PUBLIC_TRAYS_PATH } from "@/constants/routes"

import HomePublicTraysFeature from "./HomePublicTraysFeature"

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- lightweight stub for next/image in tests
    <img src={src} alt={alt} />
  ),
}))

vi.mock("@/components/Atoms/Button/VooDooLink", () => ({
  VooDooLink: ({ url, children }: { url: string; children: ReactNode }) => (
    <a href={url}>{children}</a>
  ),
}))

describe("Public Trays homepage gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("reads communityShelves from FEATURE_COMMUNITY_SHELVES and defaults to on", async () => {
    vi.stubEnv("FEATURE_COMMUNITY_SHELVES", "")
    expect((await import("@/utils/feature-flags")).isFeatureEnabled("communityShelves")).toBe(true)

    vi.resetModules()
    vi.stubEnv("FEATURE_COMMUNITY_SHELVES", "false")
    expect((await import("@/utils/feature-flags")).isFeatureEnabled("communityShelves")).toBe(false)
  })

  it("renders nothing when the feature is disabled", () => {
    const { container } = render(<HomePublicTraysFeature enabled={false} />)

    expect(container.firstChild).toBeNull()
  })

  it("links to the Public Trays route when enabled", () => {
    render(<HomePublicTraysFeature enabled />)

    expect(
      screen.getByRole("link", { name: "home.galleryWalk.publicTrays.cta" }).getAttribute("href")
    ).toBe(PUBLIC_TRAYS_PATH)
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy()
  })
})
