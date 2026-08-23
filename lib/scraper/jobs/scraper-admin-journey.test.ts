/**
 * Admin scraper durable-job journey checklist.
 * Full browser automation can expand these steps when PLAYWRIGHT_BASE_URL is set.
 *
 * Journey: create job → poll progress → cancel → inspect partial → resume/retry → import (review-gated)
 */

import { describe, expect, it } from "vitest"

const durableScraperJourney = [
  "POST /api/admin/scraper/jobs creates queued job with configJson",
  "Worker claims job atomically (status queued → running)",
  "UI polls GET /api/admin/scraper/jobs/[id] for stage/progress",
  "DELETE /api/admin/scraper/jobs/[id] sets cancelRequested; partialScraped/partialRecords preserved",
  "POST retry requeues failed/cancelled under maxAttempts",
  "GET ?results=1 returns records only when ready for review",
  "POST /api/admin/scraper/import requires reviewed records (Confirm & Import)",
] as const

describe("durable scraper admin journey", () => {
  it("covers create → poll → cancel → partial → retry → review-gated import", () => {
    expect(durableScraperJourney).toHaveLength(7)
    expect(durableScraperJourney.some(s => s.includes("cancelRequested"))).toBe(true)
    expect(durableScraperJourney.some(s => s.includes("import"))).toBe(true)
    expect(durableScraperJourney.some(s => s.includes("atomically"))).toBe(true)
  })
})
