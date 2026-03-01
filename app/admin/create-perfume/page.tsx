import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { CreatePerfumeClient } from "./CreatePerfumeClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("createPerfume.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const CreatePerfumePage = () => <CreatePerfumeClient />

export default CreatePerfumePage
