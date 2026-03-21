import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("allHouses.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

/** Legacy route - redirect to /houses (Behind the Bottle) */
export default function BehindTheBottlePage() {
  redirect("/houses")
}
