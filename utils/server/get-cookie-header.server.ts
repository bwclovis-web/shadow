import { cookies } from "next/headers"

/**
 * Build a Cookie header string from Next.js server cookies.
 * Use when passing cookies to getSessionFromCookieHeader or other server helpers.
 */
export async function getCookieHeader(): Promise<string> {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}
