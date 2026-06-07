import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getPublicTraderByIdMock = vi.fn()

vi.mock("@/models/user.server", () => ({
  getPublicTraderById: (...args: unknown[]) => getPublicTraderByIdMock(...args),
}))

import { GET } from "./route"

describe("GET /api/trader/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns trader without email", async () => {
    getPublicTraderByIdMock.mockResolvedValue({
      id: "trader-1",
      username: "traderone",
      firstName: "Trader",
      lastName: "One",
    })

    const response = await GET(new NextRequest("http://localhost/api/trader/trader-1"), {
      params: Promise.resolve({ id: "trader-1" }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.trader).toMatchObject({ id: "trader-1", username: "traderone" })
    expect(body.trader).not.toHaveProperty("email")
  })
})
