import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateUser = vi.fn()
const mockRequireCSRF = vi.fn()
const mockTransitionTrade = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => mockRequireCSRF(...args),
  CSRFError: class CSRFError extends Error {
    override name = "CSRFError"
  },
}))
vi.mock("@/models/trade.server", () => ({
  transitionTrade: (...args: unknown[]) => mockTransitionTrade(...args),
}))

let PATCH: (request: Request, context: { params: Promise<{ tradeId: string }> }) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  mockAuthenticateUser.mockResolvedValue({
    success: true,
    user: { id: "ccounterparty1234567890123", email: "c@d.com", role: "user" },
  })
  mockRequireCSRF.mockResolvedValue(undefined)
  mockTransitionTrade.mockResolvedValue({ id: "trade-1", status: "accepted" })

  const mod = await import("./route")
  PATCH = mod.PATCH
})

describe("PATCH /api/trades/[tradeId]/accept", () => {
  it("transitions trade to accepted", async () => {
    const formData = new FormData()
    const request = new Request("http://localhost/api/trades/trade-1/accept", {
      method: "PATCH",
      body: formData,
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ tradeId: "trade-1" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockTransitionTrade).toHaveBeenCalledWith({
      tradeId: "trade-1",
      actorUserId: "ccounterparty1234567890123",
      action: "accept",
      metadata: undefined,
    })
  })
})
