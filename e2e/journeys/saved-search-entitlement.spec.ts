import { FREE_AUTH_FILE, PREMIUM_AUTH_FILE } from "../fixtures/paths"
import { test, expect, gotoApp, postJsonWithCsrf } from "../fixtures/test"

test.describe("journeys: saved-search entitlement", () => {
  test("free user receives Premium upgrade on saved-searches API", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: FREE_AUTH_FILE })
    const page = await context.newPage()
    // Light page for CSRF cookie — avoid cold-compiling the archive twice.
    await gotoApp(page, "/")
    const result = await postJsonWithCsrf(page, "/api/saved-searches", {
      name: "E2E free attempt",
      query: { q: "E2E", source: "archive" },
    })
    expect(result.status).toBe(403)
    expect((result.data as { upgradeRequired?: boolean }).upgradeRequired).toBe(
      true
    )
    await context.close()
  })

  test("premium user can create a saved search via API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: PREMIUM_AUTH_FILE })
    const page = await context.newPage()
    await gotoApp(page, "/")
    const name = `E2E premium ${Date.now()}`
    const result = await postJsonWithCsrf(page, "/api/saved-searches", {
      name,
      query: { q: "Amber", source: "archive", alertOnNewListing: true },
    })
    expect(result.status).toBe(200)
    expect((result.data as { success?: boolean }).success).toBe(true)

    const list = await page.evaluate(async () => {
      const res = await fetch("/api/saved-searches", { credentials: "include" })
      return res.json()
    })
    expect(list.success).toBe(true)
    const names = (list.searches as Array<{ name: string }>).map((s) => s.name)
    expect(names.some((n) => n.includes("E2E premium"))).toBeTruthy()
    await context.close()
  })
})
