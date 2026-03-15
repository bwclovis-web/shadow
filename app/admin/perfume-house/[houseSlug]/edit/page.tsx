import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getPerfumeHouseBySlug } from "@/models/house.server"

import { EditHouseClient } from "./EditHouseClient"

type Props = {
  params: Promise<{ houseSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { houseSlug } = await params
  const perfumeHouse = await getPerfumeHouseBySlug(houseSlug)

  if (!perfumeHouse) {
    return { title: "House not found" }
  }

  return {
    title: `Edit ${perfumeHouse.name}`,
    description: `Edit perfume house ${perfumeHouse.name}`,
  }
}

const EditPerfumeHousePage = async ({ params }: Props) => {
  const { houseSlug } = await params
  const perfumeHouse = await getPerfumeHouseBySlug(houseSlug)

  if (!perfumeHouse) {
    notFound()
  }

  return <EditHouseClient initialHouse={perfumeHouse} />
}

export default EditPerfumeHousePage

