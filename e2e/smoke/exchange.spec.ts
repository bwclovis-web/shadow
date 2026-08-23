import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: exchange", () => {
  test("exchange page loads filter/search chrome", async ({ page }) => {
    await gotoApp(page, "/the-exchange")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible()
  })
})
