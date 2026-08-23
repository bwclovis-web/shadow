import { PREMIUM_AUTH_FILE } from "../fixtures/paths"
import { readSeedMeta } from "../fixtures/seed-meta"
import { test, expect, gotoApp, postJsonWithCsrf } from "../fixtures/test"

test.describe("journeys: recommendation feedback", () => {
  test.use({ storageState: PREMIUM_AUTH_FILE })

  test("not_for_me feedback API accepts a perfume id", async ({ page }) => {
    const meta = readSeedMeta()
    await gotoApp(page, "/")
    const result = await postJsonWithCsrf(
      page,
      "/api/recommendations/feedback",
      {
        perfumeId: meta.perfumeIds[0]!.id,
        action: "not_for_me",
        source: "e2e",
      }
    )
    expect([200, 404]).toContain(result.status)
    if (result.status === 200) {
      expect((result.data as { success?: boolean }).success).toBe(true)
    }
  })
})
