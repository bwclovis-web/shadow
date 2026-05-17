"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { updateUser } from "@/models/user.query"
import { touchUserLastActive } from "@/models/user-activity.server"
import { signInCustomer } from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getAuthRateLimits } from "@/utils/rate-limit-config.server"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { createSession } from "@/utils/security/session-manager.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getProfilePathForUser } from "@/utils/user"
import { generateUniqueUsername } from "@/utils/username-generator.server"

/** Next.js redirect() throws; re-throw so the redirect is performed. Not in next/navigation types in 16.x. */
const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")

export type SignInActionState = { error?: string } | null

const setSessionCookies = async (
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  const cookieStore = await cookies()
  const flags = getAuthCookieFlags()
  cookieStore.set("accessToken", accessToken, {
    ...flags,
    maxAge: 60 * 60,
  })
  cookieStore.set("refreshToken", refreshToken, {
    ...flags,
    maxAge: 60 * 60 * 24 * 7,
  })
}

export const signInAction = async (
  _prevState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)

    const authLimits = getAuthRateLimits()
    const clientId = getClientIdentifierFromHeaders(await headers())
    try {
      validateRateLimit(
        `auth:sign-in:${clientId}`,
        authLimits.signIn.max,
        authLimits.signIn.windowMs
      )
    } catch (res) {
      if (res instanceof Response) {
        return {
          error: "Too many sign-in attempts. Please wait and try again.",
        }
      }
      throw res
    }

    const existingUser = await signInCustomer(formData)
    if (!existingUser) {
      return { error: "Invalid email or password" }
    }

    if (existingUser.isBanned) {
      return { error: "Your account has been suspended" }
    }

    let user = existingUser
    if (!existingUser.username?.trim()) {
      const username = await generateUniqueUsername()
      await updateUser(existingUser.id, { username })
      user = { ...existingUser, username }
    }

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
    })
    await setSessionCookies(accessToken, refreshToken)
    await touchUserLastActive(user.id)
    redirect(getProfilePathForUser(user))
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong. Please try again."
    return { error: message }
  }
}
