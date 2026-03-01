"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import PerfumeForm from "@/components/Containers/Forms/PerfumeForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { FORM_TYPES } from "@/constants/general"

import {
  createPerfumeAction,
  type CreatePerfumeActionState,
} from "./actions"

const BANNER_IMAGE = "/images/createPerfume.png"

const CreatePerfumeClient = () => {
  const t = useTranslations("createPerfume")
  const [state, formAction] = useActionState(
    createPerfumeAction,
    null as CreatePerfumeActionState
  )

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        imagePos="object-center"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PerfumeForm
        formType={FORM_TYPES.CREATE_PERFUME_FORM}
        lastResult={state}
        data={null}
        action={formAction}
      />
    </section>
  )
}

export { CreatePerfumeClient }
