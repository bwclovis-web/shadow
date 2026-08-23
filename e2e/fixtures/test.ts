import fs from "node:fs"

import { test as base, expect, type Page } from "@playwright/test"

import { E2E_PASSWORD, E2E_USERS } from "../constants"
import { AUTH_DIR, FREE_AUTH_FILE, PREMIUM_AUTH_FILE } from "./paths"

export { expect }

type AuthFixtures = {
  freePage: Page
  premiumPage: Page
}

export const ensureAuthDir = () => {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
}

/** Prefer over page.goto — Next.js often never fires `load` under `next dev`. */
export const gotoApp = (
  page: Page,
  url: string,
  options?: Parameters<Page["goto"]>[1]
) =>
  page.goto(url, {
    waitUntil: "domcontentloaded",
    ...options,
  })

export const signInViaUi = async (
  page: Page,
  email: string,
  password = E2E_PASSWORD
) => {
  await gotoApp(page, "/sign-in")
  // CSRFToken is client-fetched; submit before it mounts → "Invalid security token"
  await page.locator('input[name="_csrf"]').waitFor({ state: "attached" })
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  // force: true bypasses Next.js dev overlay (nextjs-portal) intercepting clicks
  await page.getByTestId("sign-in-submit").click({ force: true })
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 45_000,
    waitUntil: "domcontentloaded",
  })
}

export const test = base.extend<AuthFixtures>({
  // Playwright's fixture callback is named `provide` (not `use`) so
  // react-hooks/rules-of-hooks does not treat it as React's `use`.
  freePage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      storageState: FREE_AUTH_FILE,
    })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },
  premiumPage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      storageState: PREMIUM_AUTH_FILE,
    })
    const page = await context.newPage()
    await provide(page)
    await context.close()
  },
})

export const authPaths = {
  free: FREE_AUTH_FILE,
  premium: PREMIUM_AUTH_FILE,
  dir: AUTH_DIR,
}

export const e2eUsers = E2E_USERS
export const e2ePassword = E2E_PASSWORD

export const freeProfilePath = `/e2e_free/profile`
export const premiumProfilePath = `/e2e_premium/profile`

export const csrfFromPage = async (page: Page): Promise<string | null> => {
  const cookies = await page.context().cookies()
  return cookies.find((c) => c.name === "_csrf")?.value ?? null
}

export const postFormWithCsrf = async (
  page: Page,
  url: string,
  fields: Record<string, string>
) => {
  const csrf = await csrfFromPage(page)
  return page.evaluate(
    async ({ url, fields, csrf }) => {
      const formData = new FormData()
      for (const [k, v] of Object.entries(fields)) formData.append(k, v)
      if (csrf) formData.append("_csrf", csrf)
      const headers: Record<string, string> = {}
      if (csrf) headers["x-csrf-token"] = csrf
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    },
    { url, fields, csrf }
  )
}

export const postJsonWithCsrf = async (
  page: Page,
  url: string,
  body: Record<string, unknown>
) => {
  const csrf = await csrfFromPage(page)
  return page.evaluate(
    async ({ url, body, csrf }) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      }
      if (csrf) {
        headers["x-csrf-token"] = csrf
        ;(body as Record<string, unknown>)._csrf = csrf
      }
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, data }
    },
    { url, body, csrf }
  )
}

export const authFileExists = (file: string) => fs.existsSync(file)
