import {
  claimNextScraperJob,
  createWorkerId,
  recoverStaleScraperJobs,
} from "@/models/scraper-job.server"
import { runScraperJob } from "@/lib/scraper/jobs/run-scraper-job.server"
import { incrementCounter } from "@/utils/server/metrics.server"

/**
 * Claim a specific queued job (or the next queued job) and execute it.
 */
export const claimAndRunScraperJob = async (options?: {
  jobId?: string
  workerId?: string
  onLog?: (message: string) => void
}) => {
  const workerId = options?.workerId ?? createWorkerId()
  await recoverStaleScraperJobs()
  const claimed = await claimNextScraperJob(workerId, { jobId: options?.jobId })
  if (!claimed) return null
  incrementCounter("scraper.job.claimed")
  const result = await runScraperJob(claimed.id, {
    workerId,
    onLog: options?.onLog,
  })
  return { job: claimed, result }
}

/**
 * Poll loop for local/dev workers. Stops when `shouldStop` returns true.
 */
export const runScraperWorkerLoop = async (options?: {
  pollIntervalMs?: number
  shouldStop?: () => boolean
  onLog?: (message: string) => void
}) => {
  const pollIntervalMs = options?.pollIntervalMs ?? 2_000
  const workerId = createWorkerId()
  options?.onLog?.(`Scraper worker started (${workerId})`)

  while (!options?.shouldStop?.()) {
    try {
      await recoverStaleScraperJobs()
      const claimed = await claimNextScraperJob(workerId)
      if (!claimed) {
        await new Promise(r => setTimeout(r, pollIntervalMs))
        continue
      }
      options?.onLog?.(`Claimed job ${claimed.id}`)
      incrementCounter("scraper.job.claimed")
      await runScraperJob(claimed.id, {
        workerId,
        onLog: options?.onLog,
      })
      options?.onLog?.(`Finished job ${claimed.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      options?.onLog?.(`Worker error: ${msg}`)
      await new Promise(r => setTimeout(r, pollIntervalMs))
    }
  }
}
