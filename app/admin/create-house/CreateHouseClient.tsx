"use client"

import type { SubmissionResult } from "@conform-to/react"
import { useActionState } from "react"
import { useTranslations } from "next-intl"

import PerfumeHouseForm from "@/components/Containers/Forms/PerfumeHouseForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { FORM_TYPES } from "@/constants/general"

import {
  createHouseAction,
  type CreateHouseActionState,
} from "./actions"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/createHouse.png"

type CreateHouseClientProps = {
  /** Prefill from query (e.g. scraper Smart Detect → create house). */
  initialName?: string
  initialWebsite?: string
}

const CreateHouseClient = ({ initialName, initialWebsite }: CreateHouseClientProps) => {
  const t = useTranslations("createHouse")
  const [state, formAction] = useActionState(
    createHouseAction,
    null as CreateHouseActionState
  )

  const prefill =
    initialName || initialWebsite
      ? { name: initialName, website: initialWebsite }
      : undefined

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper>
      <PerfumeHouseForm
        formType={FORM_TYPES.CREATE_HOUSE_FORM}
        lastResult={state as SubmissionResult | null}
        action={formAction}
        data={prefill}
      />
      </PageWrapper>
    </main>
  )
}

export { CreateHouseClient }
