import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getPerfumeHouseBySlug } from "@/models/house.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import HouseDetailClient from "./HouseDetailClient"

const DEFAULT_PAGE_SIZE = 8

export const ROUTE_PATH = "/houses"

type Props = {
  params: Promise<{ houseSlug: string }>
  searchParams: Promise<{ pg?: string; letter?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { houseSlug } = await params
  const perfumeHouse = await getPerfumeHouseBySlug(houseSlug, {
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
  })
  if (!perfumeHouse) {
    return { title: "House not found" }
  }
  return {
    title: perfumeHouse.name,
    description: perfumeHouse.description
      ? `${perfumeHouse.name} – perfume house`
      : undefined,
  }
}

export default async function HouseDetailPage({ params, searchParams }: Props) {
  const { houseSlug } = await params
  const resolvedSearchParams = await searchParams

  const [perfumeHouse, session] = await Promise.all([
    getPerfumeHouseBySlug(houseSlug, {
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    }),
    (async () => {
      const cookieStore = await cookies()
      const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ")
      return getSessionFromCookieHeader(cookieHeader, { includeUser: true })
    })(),
  ])

  if (!perfumeHouse) {
    notFound()
  }

  const user = session?.user ?? null

  return (
    <HouseDetailClient
      initialPerfumeHouse={perfumeHouse}
      user={user}
      initialSearchParams={{
        pg: resolvedSearchParams.pg ?? "1",
        letter: resolvedSearchParams.letter ?? undefined,
      }}
    />
  )
}
