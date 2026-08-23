import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: archive", () => {
  test("archive landing loads", async ({ page }) => {
    await gotoApp(page, "/the-archive")
    await expect(page.locator("#main-content")).toBeVisible()
  })

  test("archive search query renders results chrome", async ({ page }) => {
    await gotoApp(page, "/the-archive?q=E2E")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
  })
})
