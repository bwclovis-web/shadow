import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheVaultClient from "./TheVaultClient"

export const ROUTE_PATH = "/the-vault"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const TheVaultPage = () => (
  <TheVaultClient
    initialLetter={null}
    initialPerfumes={[]}
    initialPerfumeTotal={0}
  />
)

export default TheVaultPage
