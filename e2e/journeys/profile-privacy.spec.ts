import { FREE_AUTH_FILE } from "../fixtures/paths"
import { readSeedMeta } from "../fixtures/seed-meta"
import { test, expect, gotoApp, postFormWithCsrf } from "../fixtures/test"

test.describe("journeys: profile privacy", () => {
  test.use({ storageState: FREE_AUTH_FILE })

  test("wishlist visibility can be toggled via API and persists", async ({
    page,
  }) => {
    const meta = readSeedMeta()
    const perfumeId = meta.perfumeIds[0]!.id
    await gotoApp(page, "/")

    const makePublic = await postFormWithCsrf(page, "/api/wishlist", {
      perfumeId,
      action: "updateVisibility",
      isPublic: "true",
    })
    expect(makePublic.status).toBeLessThan(500)
    expect(makePublic.ok).toBeTruthy()

    const makePrivate = await postFormWithCsrf(page, "/api/wishlist", {
      perfumeId,
      action: "updateVisibility",
      isPublic: "false",
    })
    expect(makePrivate.ok).toBeTruthy()

    await gotoApp(page, `/${meta.freeProfileSlug}/profile/wishlist`)
    await expect(page.locator("#main-content")).toBeVisible()
    await expect(
      page.getByText(meta.perfumeIds[0]!.name, { exact: false }).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})
