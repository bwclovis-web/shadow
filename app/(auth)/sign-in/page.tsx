import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import SignInClient from "../SignInClient"
import SignInIntro from "./SignInIntro"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default function SignInPage() {
  return (
    <section
      aria-labelledby="sign-in-heading"
      className="flex flex-col lg:flex-row lg:items-start lg:justify-center h-full gap-4"
    >
      <SignInIntro />
      <div className="w-full min-w-0">
        <Suspense fallback={null}>
          <SignInClient />
        </Suspense>
      </div>
    </section>
  )
}
