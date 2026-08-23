import { FREE_AUTH_FILE, PREMIUM_AUTH_FILE } from "../fixtures/paths"
import { test, expect, gotoApp, postJsonWithCsrf } from "../fixtures/test"

test.describe("journeys: membership tier", () => {
  test("premium storage state unlocks saved-searches API", async ({
    browser,
  }) => {
    const freeCtx = await browser.newContext({ storageState: FREE_AUTH_FILE })
    const freePage = await freeCtx.newPage()
    await gotoApp(freePage, "/")
    const freeResult = await postJsonWithCsrf(freePage, "/api/saved-searches", {
      name: "tier-check-free",
      query: { q: "tier", source: "archive" },
    })
    expect(freeResult.status).toBe(403)
    await freeCtx.close()

    const premiumCtx = await browser.newContext({
      storageState: PREMIUM_AUTH_FILE,
    })
    const premiumPage = await premiumCtx.newPage()
    await gotoApp(premiumPage, "/")
    const premiumResult = await postJsonWithCsrf(
      premiumPage,
      "/api/saved-searches",
      {
        name: `tier-check-premium-${Date.now()}`,
        query: { q: "tier", source: "archive" },
      }
    )
    expect(premiumResult.ok).toBeTruthy()
    expect(premiumResult.status).toBe(200)
    await premiumCtx.close()
  })
})
