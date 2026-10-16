import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getSignupAvailability } from "@/utils/server/user-limit.server"

import SignUpClient from "./SignUpClient"
import SignUpIntro from "./SignUpIntro"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp")
  const { freeOpen } = await getSignupAvailability()
  return {
    title: t("title"),
    description: freeOpen ? t("descriptionFree") : t("description"),
  }
}

type PageProps = {
  searchParams: Promise<{ session_id?: string; email?: string }>
}

const SignUpPage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const sessionId = params.session_id ?? null
  const email = params.email ?? null
  const availability = await getSignupAvailability()

  return (
    <section
      aria-labelledby="sign-up-heading"
      className="grid w-full grid-cols-1 items-start gap-6 md:gap-8 lg:grid-cols-2 lg:items-center"
    >
      <SignUpIntro availability={availability} />
      <div className="w-full min-w-0">
        <SignUpClient
          freeSignupAvailable={availability.freeOpen}
          sessionId={sessionId}
          prefillEmail={email}
        />
      </div>
    </section>
  )
}

export default SignUpPage
