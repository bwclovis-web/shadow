import { getPerfumeHouseSummariesByIds } from "@/models/house.server"
import { getArchiveCatalogPage } from "@/models/perfume-catalog.server"
import { searchPerfumeByNameForViewer } from "@/models/perfume-search.server"
import { getPerfumeNotesByIds } from "@/models/tags.server"
import type { CatalogOption, CatalogPage, CatalogPerfumeItem } from "@/types/catalog"
import {
  type ArchiveCatalogState,
  CATALOG_PAGE_SIZE,
} from "@/utils/catalog-params"

const ARCHIVE_SEARCH_LIMIT = 40

export type ArchiveCatalogData = {
  state: ArchiveCatalogState
  catalog: CatalogPage<CatalogPerfumeItem>
  selectedHouses: CatalogOption[]
  selectedNotes: CatalogOption[]
}

/**
 * Filter ids are resolved to names first; ids that no longer resolve are dropped
 * so the applied filters, the drawer, and the result count stay in agreement.
 */
export const loadArchiveCatalog = async (
  requested: ArchiveCatalogState
): Promise<ArchiveCatalogData> => {
  const [selectedHouses, selectedNotes] = await Promise.all([
    getPerfumeHouseSummariesByIds(requested.filters.houseIds),
    getPerfumeNotesByIds(requested.filters.noteIds),
  ])
  const state: ArchiveCatalogState = {
    ...requested,
    filters: {
      ...requested.filters,
      houseIds: selectedHouses.map(house => house.id),
      noteIds: selectedNotes.map(note => note.id),
    },
  }
  const catalog = await getArchiveCatalogPage({
    letter: state.letter,
    filters: state.filters,
    sort: state.sort,
    page: state.page,
    pageSize: CATALOG_PAGE_SIZE,
  })
  return {
    state: { ...state, page: catalog.page },
    catalog,
    selectedHouses,
    selectedNotes,
  }
}

export const loadArchiveSearch = async (
  query: string
): Promise<CatalogPage<CatalogPerfumeItem>> => {
  let results: Awaited<ReturnType<typeof searchPerfumeByNameForViewer>> = []
  try {
    results = await searchPerfumeByNameForViewer(query, { limit: ARCHIVE_SEARCH_LIMIT })
  } catch (error) {
    console.error("[the-archive] search failed:", error)
  }
  return {
    items: results.map(perfume => ({
      id: perfume.id,
      name: perfume.name,
      slug: perfume.slug,
      image: perfume.image,
      isPending: perfume.isPending,
      houseName: perfume.perfumeHouse?.name ?? null,
    })),
    totalCount: results.length,
    page: 1,
    totalPages: 1,
  }
}
