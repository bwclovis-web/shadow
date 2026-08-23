import { randomUUID } from "crypto"
import type { Prisma, ScraperJob, ScraperJobStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  buildProgress,
  type ScraperJobConfigPayload,
  type ScraperJobProgress,
  type ScraperJobResultSummary,
} from "@/lib/scraper/jobs/scraper-job-types"
import { incrementCounter } from "@/utils/server/metrics.server"

/** Jobs with no heartbeat for this long are considered abandoned. */
export const SCRAPER_JOB_STALE_MS = 5 * 60 * 1000

export const createScraperJob = async (params: {
  collectionUrl: string
  houseName?: string | null
  platform?: string | null
  createdByUserId?: string | null
  config?: ScraperJobConfigPayload | null
  maxAttempts?: number
}) => {
  return prisma.scraperJob.create({
    data: {
      status: "queued",
      collectionUrl: params.collectionUrl,
      houseName: params.houseName ?? null,
      platform: params.platform ?? null,
      createdByUserId: params.createdByUserId ?? null,
      configJson: (params.config ?? undefined) as Prisma.InputJsonValue | undefined,
      maxAttempts: params.maxAttempts ?? 3,
      progressJson: buildProgress("queued", 0) as unknown as Prisma.InputJsonValue,
      resumeStage: "queued",
    },
  })
}

export const updateScraperJob = async (
  id: string,
  data: {
    status?: ScraperJobStatus
    progressJson?: ScraperJobProgress | Prisma.InputJsonValue
    resultJson?: ScraperJobResultSummary | Prisma.InputJsonValue
    partialScrapedJson?: Prisma.InputJsonValue | null
    partialRecordsJson?: Prisma.InputJsonValue | null
    configJson?: Prisma.InputJsonValue | null
    errorMessage?: string | null
    startedAt?: Date | null
    finishedAt?: Date | null
    cancelRequested?: boolean
    attemptCount?: number
    lockedAt?: Date | null
    lockedBy?: string | null
    lastHeartbeatAt?: Date | null
    resumeStage?: string | null
  }
) => {
  return prisma.scraperJob.update({
    where: { id },
    data: data as Prisma.ScraperJobUpdateInput,
  })
}

export const getScraperJob = async (id: string) => {
  return prisma.scraperJob.findUnique({ where: { id } })
}

export const requestScraperJobCancel = async (id: string) => {
  return prisma.scraperJob.update({
    where: { id },
    data: { cancelRequested: true },
  })
}

export const listRecentScraperJobs = async (limit = 20) => {
  return prisma.scraperJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

/**
 * Atomically claim the next queued job (or a specific job id if provided and queued).
 * Returns null if nothing is available.
 */
export const claimNextScraperJob = async (
  workerId: string,
  options?: { jobId?: string }
): Promise<ScraperJob | null> => {
  const now = new Date()
  return prisma.$transaction(async tx => {
    const where = options?.jobId
      ? { id: options.jobId, status: "queued" as const }
      : { status: "queued" as const }

    const candidate = await tx.scraperJob.findFirst({
      where,
      orderBy: { createdAt: "asc" },
    })
    if (!candidate) return null

    const updated = await tx.scraperJob.updateMany({
      where: { id: candidate.id, status: "queued" },
      data: {
        status: "running",
        lockedAt: now,
        lockedBy: workerId,
        lastHeartbeatAt: now,
        startedAt: candidate.startedAt ?? now,
        attemptCount: { increment: 1 },
        progressJson: buildProgress("scraping", 5, {
          jobId: candidate.id,
          message: "Job claimed by worker",
          attempt: candidate.attemptCount + 1,
        }) as unknown as Prisma.InputJsonValue,
      },
    })
    if (updated.count === 0) return null
    return tx.scraperJob.findUniqueOrThrow({ where: { id: candidate.id } })
  })
}

export const heartbeatScraperJob = async (id: string, workerId: string) => {
  const result = await prisma.scraperJob.updateMany({
    where: { id, lockedBy: workerId, status: "running" },
    data: { lastHeartbeatAt: new Date() },
  })
  return result.count > 0
}

/**
 * Re-queue abandoned running jobs whose heartbeat is stale.
 * Does not delete partial results.
 */
export const recoverStaleScraperJobs = async (
  staleMs = SCRAPER_JOB_STALE_MS
): Promise<number> => {
  const cutoff = new Date(Date.now() - staleMs)
  const stale = await prisma.scraperJob.findMany({
    where: {
      status: "running",
      OR: [
        { lastHeartbeatAt: { lt: cutoff } },
        { lastHeartbeatAt: null, lockedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, attemptCount: true, maxAttempts: true },
  })

  let recovered = 0
  for (const job of stale) {
    const exhausted = job.attemptCount >= job.maxAttempts
    await prisma.scraperJob.update({
      where: { id: job.id },
      data: exhausted
        ? {
            status: "failed",
            finishedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            errorMessage: "Worker heartbeat stale; max attempts exhausted",
            progressJson: buildProgress("failed", 100, {
              jobId: job.id,
              message: "Abandoned after stale heartbeat",
            }) as unknown as Prisma.InputJsonValue,
          }
        : {
            status: "queued",
            lockedAt: null,
            lockedBy: null,
            lastHeartbeatAt: null,
            cancelRequested: false,
            progressJson: buildProgress("queued", 0, {
              jobId: job.id,
              message: "Re-queued after stale worker heartbeat",
            }) as unknown as Prisma.InputJsonValue,
          },
    })
    incrementCounter(
      exhausted ? "scraper.job.stale_exhausted" : "scraper.job.stale_recovered"
    )
    recovered += 1
  }
  return recovered
}

export const requeueScraperJobForRetry = async (id: string) => {
  const job = await prisma.scraperJob.findUnique({ where: { id } })
  if (!job) throw new Error("Job not found")
  if (job.status !== "failed" && job.status !== "cancelled") {
    throw new Error("Only failed or cancelled jobs can be retried")
  }
  if (job.attemptCount >= job.maxAttempts) {
    throw new Error("Max attempts reached")
  }
  const updated = await prisma.scraperJob.update({
    where: { id },
    data: {
      status: "queued",
      cancelRequested: false,
      errorMessage: null,
      finishedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastHeartbeatAt: null,
      progressJson: buildProgress("queued", 0, {
        jobId: id,
        message: "Queued for retry",
      }) as unknown as Prisma.InputJsonValue,
    },
  })
  incrementCounter("scraper.job.retry_queued")
  return updated
}

export const createWorkerId = (): string =>
  `worker_${randomUUID().replace(/-/g, "").slice(0, 12)}`
