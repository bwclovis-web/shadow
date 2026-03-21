import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetAllPerfumesWithOptions = vi.fn()

vi.mock("@/models/perfume.server", () => ({
  getAllPerfumesWithOptions: (...args: unknown[]) =>
    mockGetAllPerfumesWithOptions(...args),
}))

let GET: (request: NextRequest) => Promise<Response>

beforeEach(async () => {
  mockGetAllPerfumesWithOptions.mockReset()
  vi.resetModules()
  ;({ GET } = await import("./route"))
})

describe("GET /api/perfumeSortLoader", () => {
  it("returns 400 when sortBy is not allowlisted", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/perfumeSortLoader?sortBy=evil")
    )
    expect(res.status).toBe(400)
    expect(mockGetAllPerfumesWithOptions).not.toHaveBeenCalled()
  })

  it("returns 400 when cursor is not a valid record id", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/perfumeSortLoader?sortBy=name-asc&cursor=not-valid"
      )
    )
    expect(res.status).toBe(400)
    expect(mockGetAllPerfumesWithOptions).not.toHaveBeenCalled()
  })

  it("returns 400 when take is invalid", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/perfumeSortLoader?sortBy=name-asc&take=abc"
      )
    )
    expect(res.status).toBe(400)
  })

  it("returns { perfumes, nextCursor } on success", async () => {
    const id = "c123456789012345678901234"
    mockGetAllPerfumesWithOptions.mockResolvedValue({
      items: [{ id }],
      nextCursor: id,
    })
    const res = await GET(
      new NextRequest(
        "http://localhost/api/perfumeSortLoader?sortBy=name-asc&take=10"
      )
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.perfumes).toHaveLength(1)
    expect(body.nextCursor).toBe(id)
    expect(mockGetAllPerfumesWithOptions).toHaveBeenCalledWith({
      sortBy: "name-asc",
      take: 10,
      cursor: undefined,
    })
  })
})
