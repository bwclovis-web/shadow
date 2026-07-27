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

const firstString = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0]
  return value
}

const CreatePerfumeHousePage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => {
  const params = await searchParams
  const name = firstString(params.name)?.trim() || undefined
  const website = firstString(params.website)?.trim() || undefined
  return <CreateHouseClient initialName={name} initialWebsite={website} />
}

export default CreatePerfumeHousePage
