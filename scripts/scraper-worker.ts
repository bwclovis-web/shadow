/**
 * Local durable scraper worker.
 * Usage: npx tsx scripts/scraper-worker.ts
 * Env: SCRAPER_WORKER_POLL_MS (default 2000)
 */

import { runScraperWorkerLoop } from "../lib/scraper/jobs/worker-loop.server"

const pollIntervalMs =
  typeof process.env.SCRAPER_WORKER_POLL_MS === "string" &&
  /^\d+$/.test(process.env.SCRAPER_WORKER_POLL_MS)
    ? Number(process.env.SCRAPER_WORKER_POLL_MS)
    : 2_000

let stopping = false
const onSignal = () => {
  stopping = true
  console.log("[scraper-worker] shutdown requested…")
}
process.on("SIGINT", onSignal)
process.on("SIGTERM", onSignal)

console.log("[scraper-worker] polling for queued ScraperJob rows…")
void runScraperWorkerLoop({
  pollIntervalMs,
  shouldStop: () => stopping,
  onLog: message => console.log(`[scraper-worker] ${message}`),
}).then(() => {
  console.log("[scraper-worker] exited")
  process.exit(0)
})
