/** Barrel re-exports — prefer domain modules for new code. See docs/server-layers.md */
export type { PerfumeListRow, PerfumeListPage } from "./perfume-catalog.server"
export {
  getAllPerfumes,
  fetchAllPerfumesForCatalog,
  getAllPerfumesWithOptions,
  getPerfumesByLetterPaginated,
} from "./perfume-catalog.server"

export {
  getSingleUserPerfumeById,
  getPerfumeBySlug,
  getPerfumeById,
  deletePerfume,
} from "./perfume-detail.server"

export {
  searchPerfumeByName,
  searchPerfumeByNameForViewer,
} from "./perfume-search.server"

export {
  createPendingPerfumePlaceholder,
  updatePerfume,
  createPerfume,
} from "./perfume-mutations.server"

export {
  getAvailablePerfumesForDecanting,
  buildExchangeDiscoveryWhereFragments,
  fetchPerfumeIdsWithListingPriceInRange,
  getAvailablePerfumesForDecantingPaginated,
} from "./perfume-exchange.server"

