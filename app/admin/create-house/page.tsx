import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { CreateHouseClient } from "./CreateHouseClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("createHouse.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const CreatePerfumeHousePage = () => <CreateHouseClient />

export default CreatePerfumeHousePage
