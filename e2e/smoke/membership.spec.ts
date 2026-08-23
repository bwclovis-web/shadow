import { test, expect, gotoApp } from "../fixtures/test"

test.describe("smoke: membership", () => {
  test("membership page shows Member, Premium, Collector with annual prices", async ({
    page,
  }) => {
    await gotoApp(page, "/membership")
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Member" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Premium" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Collector" })).toBeVisible()
    await expect(page.getByText("$5/year")).toBeVisible()
    await expect(page.getByText("$7/year")).toBeVisible()
    await expect(page.getByText("$10/year")).toBeVisible()
    await expect(
      page.locator('a[href="/subscribe?tier=member"]').first()
    ).toBeVisible()
    await expect(
      page.locator('a[href="/subscribe?tier=premium"]').first()
    ).toBeVisible()
    await expect(
      page.locator('a[href="/subscribe?tier=collector"]').first()
    ).toBeVisible()
  })
})
