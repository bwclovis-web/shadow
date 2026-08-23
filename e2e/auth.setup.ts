import { test as setup } from "@playwright/test"

import {
  authPaths,
  e2ePassword,
  e2eUsers,
  ensureAuthDir,
  signInViaUi,
} from "./fixtures/test"

setup("authenticate free user", async ({ page }) => {
  ensureAuthDir()
  await signInViaUi(page, e2eUsers.free.email, e2ePassword)
  await page.context().storageState({ path: authPaths.free })
})

setup("authenticate premium user", async ({ page }) => {
  ensureAuthDir()
  await signInViaUi(page, e2eUsers.premium.email, e2ePassword)
  await page.context().storageState({ path: authPaths.premium })
})
