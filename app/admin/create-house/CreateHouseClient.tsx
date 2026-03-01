"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import PerfumeHouseForm from "@/components/Containers/Forms/PerfumeHouseForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { FORM_TYPES } from "@/constants/general"

import {
  createHouseAction,
  type CreateHouseActionState,
} from "./actions"

const BANNER_IMAGE = "/images/createHouse.png"

const CreateHouseClient = () => {
  const t = useTranslations("createHouse")
  const [state, formAction] = useActionState(
    createHouseAction,
    null as CreateHouseActionState
  )

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PerfumeHouseForm
        formType={FORM_TYPES.CREATE_HOUSE_FORM}
        lastResult={state}
        action={formAction}
      />
    </section>
  )
}

export { CreateHouseClient }
