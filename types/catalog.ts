import type { HouseTypeKey } from "@/utils/catalog-params"

export type CatalogPerfumeItem = {
  id: string
  name: string
  slug: string
  image: string | null
  isPending: boolean
  houseName: string | null
}

export type CatalogHouseItem = {
  id: string
  name: string
  slug: string
  image: string | null
  houseType: HouseTypeKey
}

export type CatalogPage<T> = {
  items: T[]
  totalCount: number
  page: number
  totalPages: number
}

export type CatalogOption = { id: string; name: string }
