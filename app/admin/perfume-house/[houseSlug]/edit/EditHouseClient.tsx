"use client"

import type { SubmissionResult } from "@conform-to/react"
import { useActionState } from "react"

import PerfumeHouseForm from "@/components/Containers/Forms/PerfumeHouseForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { FORM_TYPES } from "@/constants/general"

import { editHouseAction, type EditHouseActionState } from "./actions"

const BANNER_IMAGE = "/images/createHouse.png"

type EditHouseClientProps = {
  initialHouse: Awaited<
    ReturnType<typeof import("@/models/house.server").getPerfumeHouseBySlug>
  >
}

const EditHouseClient = ({ initialHouse }: EditHouseClientProps) => {
  const [state, formAction] = useActionState(
    editHouseAction,
    null as EditHouseActionState
  )

  if (!initialHouse) {
    return <div className="p-4">House not found</div>
  }

  const formData = {
    id: initialHouse.id,
    name: initialHouse.name ?? undefined,
    description: initialHouse.description ?? undefined,
    image: initialHouse.image ?? undefined,
    website: initialHouse.website ?? undefined,
    email: initialHouse.email ?? undefined,
    phone: initialHouse.phone ?? undefined,
    address: initialHouse.address ?? undefined,
    country: initialHouse.country ?? undefined,
    founded: initialHouse.founded ?? undefined,
    type: (initialHouse as { type?: string | null }).type ?? undefined,
  }

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={`Editing ${initialHouse.name}`}
        subheading="Update perfume house details"
      />
      <PerfumeHouseForm
        formType={FORM_TYPES.EDIT_HOUSE_FORM}
        lastResult={state as SubmissionResult | null}
        data={formData}
        action={formAction}
      />
    </section>
  )
}

export { EditHouseClient }

