import { test, expect, e2eUsers, e2ePassword, signInViaUi } from "../fixtures/test"

test.describe("smoke: sign-in", () => {
  test("free user signs in and leaves the sign-in page", async ({ page }) => {
    await signInViaUi(page, e2eUsers.free.email, e2ePassword)
    await expect(page).not.toHaveURL(/\/sign-in/)
    await expect(page.locator("#main-content")).toBeVisible()
  })
})
