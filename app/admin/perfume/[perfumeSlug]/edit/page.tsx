import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getPerfumeBySlug } from "@/models/perfume.server"

import { EditPerfumeClient } from "./EditPerfumeClient"

type Props = {
  params: Promise<{ perfumeSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { perfumeSlug } = await params
  const perfume = await getPerfumeBySlug(perfumeSlug)

  if (!perfume) {
    return { title: "Perfume not found" }
  }

  return {
    title: `Edit ${perfume.name}`,
    description: `Edit perfume ${perfume.name}`,
  }
}

const EditPerfumePage = async ({ params }: Props) => {
  const { perfumeSlug } = await params
  const perfume = await getPerfumeBySlug(perfumeSlug)

  if (!perfume) {
    notFound()
  }

  return <EditPerfumeClient initialPerfume={perfume} />
}

export default EditPerfumePage
