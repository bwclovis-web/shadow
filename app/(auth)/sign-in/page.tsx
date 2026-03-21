import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import SignInClient from "../SignInClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default function SignInPage() {
  return <SignInClient />
}
