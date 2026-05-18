import { cookies } from "next/headers"

import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import {
  getPending2faCookieName,
  getPending2faSetupCookieName,
} from "@/utils/security/pending-2fa.server"

export const setSessionCookies = async (
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

export const clearPending2faCookies = async (): Promise<void> => {
  const cookieStore = await cookies()
  const flags = getAuthCookieFlags()
  cookieStore.set(getPending2faCookieName(), "", { ...flags, maxAge: 0 })
  cookieStore.set(getPending2faSetupCookieName(), "", { ...flags, maxAge: 0 })
}
