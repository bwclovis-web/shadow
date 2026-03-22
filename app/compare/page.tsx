import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import ComparePageClient from "./ComparePageClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compare.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default function ComparePage() {
  return <ComparePageClient />
}
