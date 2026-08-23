import { beforeEach, describe, expect, it, vi } from "vitest"

const updateMany = vi.fn()
const findFirst = vi.fn()
const findUniqueOrThrow = vi.fn()
const findMany = vi.fn()
const update = vi.fn()
const create = vi.fn()
const findUnique = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    scraperJob: {
      create,
      findFirst,
      findUnique,
      findUniqueOrThrow,
      findMany,
      update,
      updateMany,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        scraperJob: {
          findFirst,
          updateMany,
          findUniqueOrThrow,
        },
      }),
  },
}))

vi.mock("@/utils/server/metrics.server", () => ({
  incrementCounter: vi.fn(),
}))

describe("scraper job claiming", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("claims a queued job atomically", async () => {
    const { claimNextScraperJob } = await import("@/models/scraper-job.server")
    const queued = {
      id: "job1",
      status: "queued",
      attemptCount: 0,
      startedAt: null,
    }
    findFirst.mockResolvedValue(queued)
    updateMany.mockResolvedValue({ count: 1 })
    findUniqueOrThrow.mockResolvedValue({ ...queued, status: "running", lockedBy: "w1" })

    const claimed = await claimNextScraperJob("w1")
    expect(claimed?.id).toBe("job1")
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1", status: "queued" },
      })
    )
  })

  it("returns null when another worker already claimed", async () => {
    const { claimNextScraperJob } = await import("@/models/scraper-job.server")
    findFirst.mockResolvedValue({ id: "job1", status: "queued", attemptCount: 0 })
    updateMany.mockResolvedValue({ count: 0 })

    const claimed = await claimNextScraperJob("w2")
    expect(claimed).toBeNull()
  })
})

describe("stale recovery and retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("re-queues stale running jobs under max attempts", async () => {
    const { recoverStaleScraperJobs } = await import("@/models/scraper-job.server")
    findMany.mockResolvedValue([{ id: "stale1", attemptCount: 1, maxAttempts: 3 }])
    update.mockResolvedValue({})

    const recovered = await recoverStaleScraperJobs(1000)
    expect(recovered).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale1" },
        data: expect.objectContaining({ status: "queued", lockedBy: null }),
      })
    )
  })

  it("fails stale jobs that exhausted attempts", async () => {
    const { recoverStaleScraperJobs } = await import("@/models/scraper-job.server")
    findMany.mockResolvedValue([{ id: "dead1", attemptCount: 3, maxAttempts: 3 }])
    update.mockResolvedValue({})

    await recoverStaleScraperJobs(1000)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dead1" },
        data: expect.objectContaining({ status: "failed" }),
      })
    )
  })

  it("requeues failed jobs for retry and rejects non-retryable", async () => {
    const { requeueScraperJobForRetry } = await import("@/models/scraper-job.server")
    findUnique.mockResolvedValue({
      id: "job2",
      status: "failed",
      attemptCount: 1,
      maxAttempts: 3,
    })
    update.mockResolvedValue({ id: "job2", status: "queued" })

    const retried = await requeueScraperJobForRetry("job2")
    expect(retried.status).toBe("queued")

    findUnique.mockResolvedValue({
      id: "job3",
      status: "running",
      attemptCount: 1,
      maxAttempts: 3,
    })
    await expect(requeueScraperJobForRetry("job3")).rejects.toThrow(/Only failed or cancelled/)
  })

  it("preserves cancel request without clearing partial fields", async () => {
    const { requestScraperJobCancel } = await import("@/models/scraper-job.server")
    update.mockResolvedValue({ id: "job4", cancelRequested: true })
    await requestScraperJobCancel("job4")
    expect(update).toHaveBeenCalledWith({
      where: { id: "job4" },
      data: { cancelRequested: true },
    })
  })
})
