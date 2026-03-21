/**
 * JWT session cookie flags for `accessToken` and `refreshToken`.
 * Production: HttpOnly, Secure, SameSite=Strict. Dev (HTTP localhost): SameSite=lax, Secure=false.
 */

const isProduction = process.env.NODE_ENV === "production"

export type AuthCookieFlags = {
  httpOnly: true
  path: "/"
  secure: boolean
  sameSite: "lax" | "strict"
}

export const getAuthCookieFlags = (): AuthCookieFlags => ({
  httpOnly: true,
  path: "/",
  secure: isProduction,
  sameSite: isProduction ? "strict" : "lax",
})
