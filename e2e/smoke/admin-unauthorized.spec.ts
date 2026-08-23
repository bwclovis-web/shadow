import { FREE_AUTH_FILE } from "../fixtures/paths"
import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: admin unauthorized", () => {
  test.use({ storageState: FREE_AUTH_FILE })

  test("free user cannot open admin", async ({ page }) => {
    const response = await gotoApp(page, "/admin", { timeout: 30_000 })
    await page.waitForTimeout(2_000)
    const url = page.url()

    const leftAdmin =
      !/\/admin(\/|$)/.test(new URL(url).pathname) ||
      /unauthorized|sign-in|security/.test(url)

    const blockedChrome =
      (await page.getByText(/scraper worker|performance dashboard|data quality/i).count()) ===
      0

    expect(leftAdmin || blockedChrome).toBeTruthy()
    if (response && response.status() === 200 && /\/admin(\/|$)/.test(new URL(url).pathname)) {
      await expect(
        page.getByRole("heading", { name: /admin|scraper|dashboard/i })
      ).toHaveCount(0)
    }
  })
})
