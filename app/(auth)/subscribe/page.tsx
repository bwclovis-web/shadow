import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import SubscribeClient from "./SubscribeClient"
import SubscribeIntro from "./SubscribeIntro"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscribe")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const SubscribePage = () => (
  <section
    aria-labelledby="subscribe-heading"
    className="grid w-full grid-cols-1 items-start gap-6 md:gap-8 lg:grid-cols-2 lg:items-center"
  >
    <SubscribeIntro />
    <div className="w-full min-w-0">
      <Suspense fallback={null}>
        <SubscribeClient />
      </Suspense>
    </div>
  </section>
)

export default SubscribePage
