import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import SignUpClient from "./SignUpClient"
import SignUpIntro from "./SignUpIntro"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp")
  return {
    title: t("title"),
    description: t("description"),
  }
}

type PageProps = {
  searchParams: Promise<{ session_id?: string; email?: string }>
}

const SignUpPage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const sessionId = params.session_id ?? null
  const email = params.email ?? null

  return (
    <>
      <SignUpIntro />
      <div className="w-full lg:w-1/2 form">
        <SignUpClient sessionId={sessionId} prefillEmail={email} />
      </div>
    </>
  )
}

export default SignUpPage
