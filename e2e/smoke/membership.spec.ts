import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: membership", () => {
  test("membership page shows Free and Premium tiers", async ({ page }) => {
    await gotoApp(page, "/membership")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Free" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible()
  })
})
