import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}))

import { touchUserLastActive } from "./user-activity.server"

describe("touchUserLastActive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateMock.mockResolvedValue({})
  })

  it("skips DB when hint is within the throttle window", async () => {
    const recent = new Date(Date.now() - 60_000)
    await touchUserLastActive("user-1", recent)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("updates without findUnique when hint is stale", async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000)
    await touchUserLastActive("user-1", stale)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lastActiveAt: expect.any(Date) },
    })
  })

  it("updates when hint is null (never active)", async () => {
    await touchUserLastActive("user-1", null)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  it("falls back to findUnique when hint is omitted", async () => {
    findUniqueMock.mockResolvedValue({
      lastActiveAt: new Date(Date.now() - 60_000),
    })
    await touchUserLastActive("user-1")
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { lastActiveAt: true },
    })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
