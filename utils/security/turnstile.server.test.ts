// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { verifyTurnstileToken } from "./turnstile.server"

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("Turnstile configuration and verification", () => {
  it("rejects missing configuration in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")
    expect((await verifyTurnstileToken(null)).ok).toBe(false)
  })
  it("allows unconfigured local development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")
    expect((await verifyTurnstileToken(null)).ok).toBe(true)
  })
  it("rejects a missing public key in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "")
    expect((await verifyTurnstileToken("token")).ok).toBe(false)
  })
  it("requires a token when configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret")
    expect((await verifyTurnstileToken(" ")).ok).toBe(false)
  })
  it.each([true, false])("honors verification success=%s", async success => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success }) }))
    expect((await verifyTurnstileToken("token")).ok).toBe(success)
  })
  it("rejects provider failures", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect((await verifyTurnstileToken("token")).ok).toBe(false)
  })
})
