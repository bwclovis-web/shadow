import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: public shelves", () => {
  test("signed-out user can browse public shelves", async ({ page }) => {
    await gotoApp(page, "/community/shelves")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(
      page
        .getByRole("heading", { name: /public shelves/i })
        .or(page.getByText(/E2E Public Shelf/i))
        .first()
    ).toBeVisible()
  })
})
