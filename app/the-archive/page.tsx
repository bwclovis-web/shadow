import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const TheArchivePage = () => (
  <TheArchiveClient
    initialLetter={null}
    initialPerfumes={[]}
    initialPerfumeTotal={0}
  />
)

export default TheArchivePage
