import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const searchPerfumeByNameForViewerMock = vi.fn()
const getSessionFromRequestMock = vi.fn()

vi.mock("@/models/perfume.server", () => ({
  searchPerfumeByNameForViewer: (...args: unknown[]) =>
    searchPerfumeByNameForViewerMock(...args),
}))

vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromRequest: (...args: unknown[]) => getSessionFromRequestMock(...args),
}))

import { GET } from "./route"

describe("GET /api/perfume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionFromRequestMock.mockResolvedValue({ userId: "viewer-1" })
    searchPerfumeByNameForViewerMock.mockResolvedValue([{ id: "p1", name: "Test", slug: "test" }])
  })

  it("passes viewer user id for pending visibility filtering", async () => {
    const req = new NextRequest("http://localhost/api/perfume?name=test")
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(searchPerfumeByNameForViewerMock).toHaveBeenCalledWith("test", {
      viewerUserId: "viewer-1",
    })
  })
})
