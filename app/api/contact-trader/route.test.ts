import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateUser = vi.fn()
const mockRequireCSRF = vi.fn()
const mockGetContactMessageRateLimits = vi.fn()
const mockValidateRateLimit = vi.fn()
const mockCreateContactMessage = vi.fn()
const mockCreateUserAlert = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => mockRequireCSRF(...args),
  CSRFError: class CSRFError extends Error {
    override name = "CSRFError"
  },
}))
vi.mock("@/utils/rate-limit-config.server", () => ({
  getContactMessageRateLimits: () => mockGetContactMessageRateLimits(),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: (...args: unknown[]) => mockValidateRateLimit(...args),
}))
vi.mock("@/models/contactMessage.server", () => ({
  createContactMessage: (...args: unknown[]) => mockCreateContactMessage(...args),
}))
vi.mock("@/models/user-alerts.server", () => ({
  createUserAlert: (...args: unknown[]) => mockCreateUserAlert(...args),
}))
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

let POST: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  mockAuthenticateUser.mockResolvedValue({
    success: true,
    user: { id: "sender-123", email: "sender@example.com", role: "user" },
  })
  mockRequireCSRF.mockResolvedValue(undefined)
  mockGetContactMessageRateLimits.mockReturnValue({
    perUser: { max: 10, windowMs: 60 * 60 * 1000 },
    perPair: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  })
  mockValidateRateLimit.mockReturnValue(undefined)
  mockCreateContactMessage.mockResolvedValue({ id: "msg-1" })
  const { prisma } = await import("@/lib/db")
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    username: "sender",
    firstName: "Sender",
    lastName: "User",
  } as Awaited<ReturnType<typeof prisma.user.findUnique>>)
  mockCreateUserAlert.mockResolvedValue(undefined)

  const mod = await import("./route")
  POST = mod.POST
})

async function buildRequest(overrides: { recipientId?: string; subject?: string; message?: string } = {}) {
  const formData = new FormData()
  formData.set("recipientId", overrides.recipientId ?? "recipient-456")
  formData.set("message", overrides.message ?? "Hello, I am interested in your listing.")
  if (overrides.subject !== undefined) formData.set("subject", overrides.subject)
  return new Request("http://localhost/api/contact-trader", {
    method: "POST",
    body: formData,
  })
}

describe("POST /api/contact-trader", () => {
  it("calls validateRateLimit with perUser and perPair identifiers", async () => {
    const request = await buildRequest()

    await POST(request)

    expect(mockValidateRateLimit).toHaveBeenCalledTimes(2)
    expect(mockValidateRateLimit).toHaveBeenNthCalledWith(
      1,
      "contact-trader:user:sender-123",
      10,
      60 * 60 * 1000
    )
    expect(mockValidateRateLimit).toHaveBeenNthCalledWith(
      2,
      "contact-trader:pair:sender-123:recipient-456",
      3,
      24 * 60 * 60 * 1000
    )
  })

  it("returns 429 when validateRateLimit throws a Response (perUser limit)", async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded", retryAfter: 120 }),
      { status: 429, headers: { "Retry-After": "120" } }
    )
    mockValidateRateLimit.mockImplementation(() => {
      throw rateLimitResponse
    })

    const request = await buildRequest()
    const response = await POST(request)

    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.error).toBe("Rate limit exceeded")
  })

  it("returns 429 when second validateRateLimit call throws (perPair limit)", async () => {
    let callCount = 0
    const rateLimitResponse = new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded", retryAfter: 60 }),
      { status: 429 }
    )
    mockValidateRateLimit.mockImplementation(() => {
      callCount++
      if (callCount === 2) throw rateLimitResponse
    })

    const request = await buildRequest()
    const response = await POST(request)

    expect(response.status).toBe(429)
  })

  it("returns 200 and creates message when rate limits pass", async () => {
    const request = await buildRequest({ message: "Test message with enough length for validation." })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockCreateContactMessage).toHaveBeenCalledWith({
      senderId: "sender-123",
      recipientId: "recipient-456",
      subject: null,
      message: "Test message with enough length for validation.",
    })
  })
})
