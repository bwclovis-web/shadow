// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const { query, audit } = vi.hoisted(() => ({ query: vi.fn(), audit: vi.fn() }))
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: query } }))
vi.mock("@/utils/security/security-audit.server", () => ({ logSecurityAudit: audit }))
import { enforceDurableRateLimit } from "./durable-rate-limit.server"

beforeEach(() => { vi.clearAllMocks() })
describe("durable rate limit decisions", () => {
  it("admits the last available request", async () => {
    query.mockResolvedValue([{ count: 3, resetAt: new Date(Date.now() + 60_000) }])
    await expect(enforceDurableRateLimit("boundary", 3, 60_000)).resolves.toBeUndefined()
  })
  it("returns 429 with Retry-After after the limit, without falling back", async () => {
    query.mockResolvedValue([{ count: 4, resetAt: new Date(Date.now() + 60_000) }])
    const error = await enforceDurableRateLimit("blocked", 3, 60_000).catch(e => e)
    expect(error).toBeInstanceOf(Response)
    expect(error.status).toBe(429)
    expect(Number(error.headers.get("Retry-After"))).toBeGreaterThan(0)
    expect(audit).toHaveBeenCalledOnce()
  })
  it("does not let audit failure bypass a rejected request", async () => {
    query.mockResolvedValue([{ count: 2, resetAt: new Date(Date.now() + 60_000) }])
    audit.mockRejectedValueOnce(new Error("offline"))
    const error = await enforceDurableRateLimit("audit-failure", 1).catch(e => e)
    expect(error.status).toBe(429)
  })
  it("still limits requests in the existing memory fallback when the database fails", async () => {
    query.mockRejectedValue(new Error("offline"))
    await enforceDurableRateLimit("fallback-test", 1, 60_000)
    const error = await enforceDurableRateLimit("fallback-test", 1, 60_000).catch(e => e)
    expect(error.status).toBe(429)
  })
})
