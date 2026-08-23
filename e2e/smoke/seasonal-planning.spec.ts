import { FREE_AUTH_FILE } from "../fixtures/paths"
import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: seasonal planning gate", () => {
  test.use({ storageState: FREE_AUTH_FILE })

  test("free user sees upgrade messaging", async ({ page }) => {
    await gotoApp(page, "/seasonal-planning")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(
      page.getByText(/premium benefit|view membership|upgrade/i).first()
    ).toBeVisible()
  })
})
