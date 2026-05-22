"use client"

import type { SubmissionResult } from "@conform-to/react"
import { useActionState } from "react"

import PerfumeForm from "@/components/Containers/Forms/PerfumeForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { FORM_TYPES } from "@/constants/general"

import { editPerfumeAction, type EditPerfumeActionState } from "./actions"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/createPerfume.png"

type EditPerfumeClientProps = {
  initialPerfume: Awaited<
    ReturnType<typeof import("@/models/perfume.server").getPerfumeBySlug>
  > & { id: string }
}

const EditPerfumeClient = ({ initialPerfume }: EditPerfumeClientProps) => {
  const [state, formAction] = useActionState(
    editPerfumeAction,
    null as EditPerfumeActionState
  )

  if (!initialPerfume) {
    return <div className="p-4">Perfume not found</div>
  }

  const formData = {
    id: initialPerfume.id,
    name: initialPerfume.name ?? undefined,
    description: initialPerfume.description ?? undefined,
    image: initialPerfume.image ?? undefined,
    perfumeHouseId:
      initialPerfume.perfumeHouse?.id ?? (initialPerfume as { perfumeHouseId?: string }).perfumeHouseId ?? undefined,
    perfumeHouse: initialPerfume.perfumeHouse ?? undefined,
    perfumeNotesOpen: initialPerfume.perfumeNotesOpen ?? undefined,
    perfumeNotesHeart: initialPerfume.perfumeNotesHeart ?? undefined,
    perfumeNotesClose: initialPerfume.perfumeNotesClose ?? undefined,
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        imagePos="object-center"
        heading={`Editing ${initialPerfume.name}`}
        subheading="Update perfume details"
      />
      <PageWrapper>
      <PerfumeForm
        formType={FORM_TYPES.EDIT_PERFUME_FORM}
        lastResult={state as SubmissionResult | null}
        data={formData}
        action={formAction}
        />
      </PageWrapper>
    </main>
  )
}

export { EditPerfumeClient }
