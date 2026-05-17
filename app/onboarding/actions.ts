"use server"

import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"

import {
  completeOnboarding,
  dismissOnboarding,
} from "@/models/onboarding.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

export type OnboardingActionState =
  | { success: true }
  | { success?: false; error: string }
  | null

const requireOnboardingUser = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  if (!session?.user) {
    const t = await getTranslations("onboarding.errors")
    return { error: t("mustSignIn") } as const
  }
  return { userId: session.user.id } as const
}

export const dismissOnboardingAction = async (
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const auth = await requireOnboardingUser()
  if ("error" in auth) return { error: auth.error }

  await dismissOnboarding(auth.userId)
  revalidatePath("/", "layout")
  return { success: true }
}

export const completeOnboardingAction = async (
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const auth = await requireOnboardingUser()
  if ("error" in auth) return { error: auth.error }

  await completeOnboarding(auth.userId)
  revalidatePath("/", "layout")
  return { success: true }
}
