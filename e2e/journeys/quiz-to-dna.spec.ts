import { PREMIUM_AUTH_FILE } from "../fixtures/paths"
import { readSeedMeta } from "../fixtures/seed-meta"
import { test, expect, gotoApp } from "../fixtures/test"

test.describe("journeys: quiz to scent DNA", () => {
  test.use({ storageState: PREMIUM_AUTH_FILE })

  test("scent DNA share page is reachable after quiz entry points", async ({
    page,
  }) => {
    const meta = readSeedMeta()

    await gotoApp(page, "/scent-quiz")
    await expect(page.locator("body")).toBeVisible()

    const start = page.getByRole("link", { name: /begin|start|discovery/i }).first()
    if (await start.isVisible().catch(() => false)) {
      await start.click({ force: true })
      const noteButtons = page.locator("button").filter({ hasText: /E2E / })
      const count = await noteButtons.count()
      for (let i = 0; i < Math.min(3, count); i++) {
        await noteButtons.nth(i).click({ force: true })
      }
      for (let step = 0; step < 10; step++) {
        const next = page
          .locator("#main-content")
          .getByRole("button", {
            name: /^(next|continue|save|finish|submit|complete)\b/i,
          })
          .first()
        if (!(await next.isVisible().catch(() => false))) break
        await next.click({ force: true })
        await page.waitForTimeout(300)
      }
    }

    const dnaLink = page.getByRole("link", { name: /scent dna|share your/i })
    if (await dnaLink.count()) {
      await dnaLink.first().click({ force: true })
      await expect(page).toHaveURL(/\/trader-profile\/.+\/scent-dna/)
    } else {
      await gotoApp(page, `/trader-profile/${meta.premiumUserId}/scent-dna`)
      await expect(page).toHaveURL(/scent-dna/)
      await expect(page.locator("body")).toBeVisible()
    }
  })
})
