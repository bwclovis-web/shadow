import { PREMIUM_AUTH_FILE } from "../fixtures/paths"
import { readSeedMeta } from "../fixtures/seed-meta"
import { test, expect, gotoApp, postFormWithCsrf } from "../fixtures/test"

test.describe("journeys: collection update", () => {
  test.use({ storageState: PREMIUM_AUTH_FILE })

  test("premium user can add a perfume to collection via API", async ({
    page,
  }) => {
    const meta = readSeedMeta()
    const perfume = meta.perfumeIds[0]
    expect(perfume?.id).toBeTruthy()

    await gotoApp(page, "/")
    const result = await postFormWithCsrf(page, "/api/user-perfumes", {
      action: "add",
      perfumeId: perfume!.id,
      amount: "50",
    })
    expect(result.status).toBeLessThan(500)
    expect(result.ok).toBeTruthy()

    const listed = await page.evaluate(async () => {
      const res = await fetch("/api/user-perfumes", { credentials: "include" })
      const data = await res.json()
      return data as {
        success?: boolean
        userPerfumes?: Array<{
          perfume?: { name?: string; id?: string }
          perfumeId?: string
        }>
      }
    })
    expect(listed.success).toBe(true)
    const hasPerfume = (listed.userPerfumes ?? []).some(
      (up) =>
        up.perfumeId === perfume!.id ||
        up.perfume?.id === perfume!.id ||
        up.perfume?.name === perfume!.name
    )
    expect(hasPerfume).toBeTruthy()
  })
})
