"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { updateUser } from "@/models/user.query"
import { signInCustomer } from "@/models/user.server"
import { createSession } from "@/utils/security/session-manager.server"
import { requireCSRF } from "@/utils/server/csrf.server"
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
  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export const signInAction = async (
  _prevState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)

    const existingUser = await signInCustomer(formData)
    if (!existingUser) {
      return { error: "Invalid email or password" }
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
