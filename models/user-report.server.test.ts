import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreate = vi.fn()
const mockFindUnique = vi.fn()
const mockFindFirst = vi.fn()
const mockDelete = vi.fn()
const mockUpdate = vi.fn()
const mockAuditCreate = vi.fn()

vi.mock("@/lib/r2", () => ({
  deleteFromR2: vi.fn(),
  getR2KeyFromPublicUrl: vi.fn(() => null),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    trade: { findUnique: vi.fn() },
    userReport: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    securityAuditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}))

import {
  createUserReport,
  withdrawUserReport,
  deleteUserReportByAdmin,
} from "./user-report.server"

describe("createUserReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue({
      id: "reported",
      email: "trader@example.com",
      isBanned: false,
    })
    mockCreate.mockResolvedValue({ id: "report-1" })
  })

  it("rejects self-reports", async () => {
    const result = await createUserReport({
      reporterId: "same",
      reportedUserId: "same",
      category: "scam",
    })
    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a report for another user with images", async () => {
    const result = await createUserReport({
      reporterId: "reporter",
      reportedUserId: "reported",
      category: "harassment",
      description: " Rude messages ",
      images: ["https://cdn.example.com/a.jpg"],
    })
    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: "reporter",
          reportedUserId: "reported",
          category: "harassment",
          description: "Rude messages",
          images: ["https://cdn.example.com/a.jpg"],
          status: "inProgress",
        }),
      })
    )
  })
})

describe("withdrawUserReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows withdraw only for in-progress reports", async () => {
    mockFindFirst.mockResolvedValue({
      id: "r1",
      status: "settled",
      images: [],
    })
    const result = await withdrawUserReport("r1", "reporter")
    expect(result.success).toBe(false)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("deletes in-progress report for reporter", async () => {
    mockFindFirst.mockResolvedValue({
      id: "r1",
      status: "inProgress",
      images: [],
    })
    const result = await withdrawUserReport("r1", "reporter")
    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "r1" } })
  })
})

describe("deleteUserReportByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes report and writes audit log", async () => {
    mockFindUnique.mockResolvedValue({
      id: "r1",
      status: "inProgress",
      category: "scam",
      reporterId: "a",
      reportedUserId: "b",
      images: [],
    })
    const result = await deleteUserReportByAdmin("r1", "admin")
    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockAuditCreate).toHaveBeenCalled()
  })
})
