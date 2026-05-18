import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"

import Verify2FAClient from "./Verify2FAClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("auth.verify2fa")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function Verify2FAPage(): Promise<React.ReactElement> {
  return <Verify2FAClient />
}
