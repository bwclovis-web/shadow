import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const searchPerfumeHouseByNameForViewerMock = vi.fn()
const getSessionFromRequestMock = vi.fn()

vi.mock("@/models/house.server", () => ({
  searchPerfumeHouseByNameForViewer: (...args: unknown[]) =>
    searchPerfumeHouseByNameForViewerMock(...args),
}))

vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromRequest: (...args: unknown[]) => getSessionFromRequestMock(...args),
}))

import { GET } from "./route"

describe("GET /api/perfume-houses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionFromRequestMock.mockResolvedValue({ userId: "viewer-1" })
    searchPerfumeHouseByNameForViewerMock.mockResolvedValue([
      { id: "h1", name: "House", slug: "house" },
    ])
  })

  it("passes viewer context to house search visibility filter", async () => {
    const req = new NextRequest("http://localhost/api/perfume-houses?name=house")
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(searchPerfumeHouseByNameForViewerMock).toHaveBeenCalledWith("house", {
      includeEmpty: true,
      viewerUserId: "viewer-1",
    })
  })
})
