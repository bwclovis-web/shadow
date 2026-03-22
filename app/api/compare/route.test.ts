import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetComparePayload = vi.fn()

vi.mock("@/models/compare.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models/compare.server")>()
  return {
    ...actual,
    getComparePayload: (...args: unknown[]) =>
      mockGetComparePayload(...args) as ReturnType<typeof actual.getComparePayload>,
  }
})

let GET: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import("./route")
  GET = mod.GET
})

describe("GET /api/compare", () => {
  it("returns empty perfumes when no ids", async () => {
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/compare"))
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { perfumes: unknown[] }
    expect(body.perfumes).toEqual([])
    expect(mockGetComparePayload).not.toHaveBeenCalled()
  })

  it("returns 400 when more than max ids", async () => {
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/compare?ids=a,b,c,d"))
    )
    expect(res.status).toBe(400)
    expect(mockGetComparePayload).not.toHaveBeenCalled()
  })

  it("returns payload from getComparePayload", async () => {
    mockGetComparePayload.mockResolvedValue([
      {
        id: "p1",
        name: "One",
        slug: "one",
        description: null,
        image: null,
        perfumeHouse: null,
        perfumeNotesOpen: [],
        perfumeNotesHeart: [],
        perfumeNotesClose: [],
        averageRatings: null,
        exchangeListingCount: 0,
      },
    ])
    const res = await GET(
      new NextRequest(new URL("http://localhost/api/compare?ids=p1"))
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { perfumes: unknown[] }
    expect(body.perfumes).toHaveLength(1)
    expect(mockGetComparePayload).toHaveBeenCalledWith(["p1"])
  })
})
