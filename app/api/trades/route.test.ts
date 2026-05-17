import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateUser = vi.fn()
const mockRequireCSRF = vi.fn()
const mockGetTradeCreateRateLimits = vi.fn()
const mockValidateRateLimit = vi.fn()
const mockCreateTrade = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => mockRequireCSRF(...args),
  CSRFError: class CSRFError extends Error {
    override name = "CSRFError"
  },
}))
vi.mock("@/utils/trade-rate-limit-config.server", () => ({
  getTradeCreateRateLimits: () => mockGetTradeCreateRateLimits(),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: (...args: unknown[]) => mockValidateRateLimit(...args),
}))
vi.mock("@/models/trade.server", () => ({
  createTrade: (...args: unknown[]) => mockCreateTrade(...args),
}))

let POST: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  mockAuthenticateUser.mockResolvedValue({
    success: true,
    user: { id: INITIATOR_ID, email: "a@b.com", role: "user" },
  })
  mockRequireCSRF.mockResolvedValue(undefined)
  mockGetTradeCreateRateLimits.mockReturnValue({
    perUser: { max: 20, windowMs: 3600000 },
    perPair: { max: 10, windowMs: 86400000 },
  })
  mockValidateRateLimit.mockReturnValue(undefined)
  mockCreateTrade.mockResolvedValue({
    id: "trade-1",
    status: "pending",
    initiatorId: "initiator-1",
    counterpartyId: "counter-2",
    lineItems: [],
  })

  const mod = await import("./route")
  POST = mod.POST
})

const INITIATOR_ID = "cinitiator123456789012345"
const COUNTERPARTY_ID = "ccounterparty1234567890123"
const UP_REQ = "crequestedlisting12345678901"
const UP_OFF = "cofferedlisting123456789012"

const buildRequest = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  formData.set("counterpartyId", overrides.counterpartyId ?? COUNTERPARTY_ID)
  formData.set(
    "lineItems",
    overrides.lineItems ??
      JSON.stringify([
        { userPerfumeId: UP_REQ, role: "requested" },
        { userPerfumeId: UP_OFF, role: "offered" },
      ])
  )
  if (overrides.submit !== undefined) formData.set("submit", overrides.submit)
  if (overrides.notes) formData.set("notes", overrides.notes)
  return new Request("http://localhost/api/trades", { method: "POST", body: formData })
}

describe("POST /api/trades", () => {
  it("creates trade with rate limits and returns success", async () => {
    const response = await POST(buildRequest({ submit: "true" }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockValidateRateLimit).toHaveBeenCalledWith(
      `trade-create:user:${INITIATOR_ID}`,
      20,
      3600000
    )
    expect(mockCreateTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatorId: INITIATOR_ID,
        counterpartyId: COUNTERPARTY_ID,
        submit: true,
      })
    )
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthenticateUser.mockResolvedValue({
      success: false,
      error: "Unauthorized",
      status: 401,
    })

    const response = await POST(buildRequest())
    expect(response.status).toBe(401)
  })
})
