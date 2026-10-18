"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import AdSenseUnit from "@/components/Atoms/AdSenseUnit"
import { Button } from "@/components/Atoms/Button/Button"
import ArchiveFilterFields, {
  type ArchiveFilterDraft,
  countArchiveFilterDraft,
} from "@/components/Containers/Catalog/ArchiveFilterFields"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import type { CatalogItemDisplay } from "@/components/Molecules/CatalogItem/CatalogItem"
import { SaveSearchButton } from "@/components/Molecules/SaveSearchButton/SaveSearchButton"
import CatalogFilterDrawer from "@/components/Organisms/CatalogFilterDrawer/CatalogFilterDrawer"
import CatalogResults from "@/components/Organisms/CatalogResults/CatalogResults"
import CatalogToolbar from "@/components/Organisms/CatalogToolbar/CatalogToolbar"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { PERFUME_PATH } from "@/constants/routes"
import { useCatalogNavigation } from "@/hooks/useCatalogNavigation"
import type { CatalogOption, CatalogPage, CatalogPerfumeItem } from "@/types/catalog"
import {
  ARCHIVE_SORTS,
  type ArchiveCatalogState,
  type ArchiveSort,
  buildArchiveCatalogHref,
  countArchiveFilters,
  emptyArchiveFilters,
} from "@/utils/catalog-params"
import {
  perfumeImageTransitionName,
  perfumeTitleTransitionName,
} from "@/utils/view-transition-names"

const BANNER_IMAGE = "/images/new/vault.webp"
const FALLBACK_IMAGE = "/images/single-bottle.webp"

export type TheArchiveClientProps = {
  state: ArchiveCatalogState
  catalog: CatalogPage<CatalogPerfumeItem>
  selectedHouses: CatalogOption[]
  selectedNotes: CatalogOption[]
  /** From `?q=`: relevance-ranked name search instead of the filtered catalog. */
  searchQuery: string | null
  showAds?: boolean
}

const TheArchiveClient = ({
  state,
  catalog,
  selectedHouses,
  selectedNotes,
  searchQuery,
  showAds = true,
}: TheArchiveClientProps) => {
  const t = useTranslations("allPerfumes")
  const tCatalog = useTranslations("catalog")
  const tSort = useTranslations("sortOptions")
  const { isPending, state: requested, navigate, prefetch } = useCatalogNavigation(state)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState<ArchiveFilterDraft>({
    houses: selectedHouses,
    notes: selectedNotes,
    seasons: state.filters.seasons,
  })

  const isSearchMode = Boolean(searchQuery)
  const activeFilterCount = countArchiveFilters(state.filters)
  const requestedFilterCount = countArchiveFilters(requested.filters)
  const withPatch = (patch: Partial<ArchiveCatalogState>): ArchiveCatalogState => ({
    ...state,
    page: 1,
    ...patch,
  })
  /** Only a view change keeps the name search; every other action returns to browsing. */
  const go = (
    next: ArchiveCatalogState,
    options?: { scrollToResults?: boolean; keepSearch?: boolean }
  ) =>
    navigate(
      buildArchiveCatalogHref(next, options?.keepSearch ? searchQuery : null),
      next,
      options
    )

  const openFilters = () => {
    setDraft({ houses: selectedHouses, notes: selectedNotes, seasons: state.filters.seasons })
    setFiltersOpen(true)
  }

  const applyFilters = () => {
    setFiltersOpen(false)
    go(
      withPatch({
        filters: {
          houseIds: draft.houses.map(house => house.id),
          noteIds: draft.notes.map(note => note.id),
          seasons: draft.seasons,
        },
      })
    )
  }

  const items: CatalogItemDisplay[] = catalog.items.map(perfume => ({
    id: perfume.id,
    href: state.letter
      ? `${PERFUME_PATH}/${perfume.slug}?letter=${state.letter}`
      : `${PERFUME_PATH}/${perfume.slug}`,
    title: perfume.name,
    subtitle: perfume.houseName,
    image: perfume.image,
    fallbackImage: FALLBACK_IMAGE,
    imageAlt: perfume.houseName ? `${perfume.name} by ${perfume.houseName}` : perfume.name,
    isPendingReview: perfume.isPending,
    compareItem: {
      id: perfume.id,
      slug: perfume.slug,
      name: perfume.name,
      image: perfume.image ?? undefined,
    },
    imageTransitionName: perfumeImageTransitionName(perfume.id),
    titleTransitionName: perfumeTitleTransitionName(perfume.id),
  }))

  const emptyState = searchQuery ? (
    <p className="text-lg text-noir-light">{t("searchEmpty")}</p>
  ) : (
    <div className="flex flex-col items-start gap-4 border border-noir-gold/40 bg-noir-black/40 p-6">
      <p className="text-lg text-noir-light">
        {state.letter && activeFilterCount === 0
          ? t("emptyLetter", { letter: state.letter })
          : t("emptyFiltered")}
      </p>
      {activeFilterCount > 0 ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => go(withPatch({ filters: emptyArchiveFilters() }))}
        >
          {tCatalog("clearFilters")}
        </Button>
      ) : null}
    </div>
  )

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={searchQuery ? t("searchHeading", { query: searchQuery }) : t("heading")}
        subheading={
          searchQuery
            ? t("searchSubheading", { count: catalog.totalCount, query: searchQuery })
            : t("subheading")
        }
      />

      <PageWrapper className="space-y-6">
        <CatalogToolbar
          searchType="perfume"
          sortOptions={ARCHIVE_SORTS.map(sort => ({ id: sort, name: sort, label: tSort(sort) }))}
          sort={requested.sort}
          onSortChange={sort => go(withPatch({ sort: sort as ArchiveSort }))}
          activeFilterCount={requestedFilterCount}
          onOpenFilters={openFilters}
          view={requested.view}
          onViewChange={view => go({ ...state, view }, { keepSearch: true })}
          letter={isSearchMode ? null : requested.letter}
          onLetterSelect={letter => go(withPatch({ letter }))}
          onLetterHover={letter => prefetch(buildArchiveCatalogHref(withPatch({ letter })))}
          hideRefinements={isSearchMode}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            sort: tCatalog("toolbar.sort"),
            filters: tCatalog("toolbar.filters"),
            filtersAria: tCatalog("toolbar.filtersAria", { count: requestedFilterCount }),
            view: tCatalog("toolbar.view"),
            gridView: tCatalog("toolbar.gridView"),
            listView: tCatalog("toolbar.listView"),
            letterNav: tCatalog("toolbar.letterNav"),
          }}
        />

        <AdSenseUnit showAds={showAds} variant="display" />

        <CatalogResults
          heading={t("resultsCount", { shown: catalog.items.length, total: catalog.totalCount })}
          items={items}
          view={requested.view}
          actionLabel={t("viewAction")}
          isPending={isPending}
          pendingLabel={tCatalog("updating")}
          emptyState={emptyState}
          page={catalog.page}
          totalPages={catalog.totalPages}
          onPageChange={page => go({ ...state, page }, { scrollToResults: true })}
          aside={
            searchQuery ? (
              <div className="mb-6">
                <SaveSearchButton
                  name={`Archive: ${searchQuery.slice(0, 80)}`}
                  query={{
                    q: searchQuery,
                    perfumeName: searchQuery,
                    source: "archive",
                    alertOnEditorial: true,
                    alertOnNewListing: true,
                  }}
                />
              </div>
            ) : null
          }
        />
      </PageWrapper>

      <CatalogFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("filters.title")}
        closeLabel={tCatalog("drawer.close")}
        clearLabel={tCatalog("drawer.clearAll")}
        applyLabel={tCatalog("drawer.apply", { count: countArchiveFilterDraft(draft) })}
        onClear={() => setDraft({ houses: [], notes: [], seasons: [] })}
        onApply={applyFilters}
      >
        <ArchiveFilterFields value={draft} onChange={setDraft} />
      </CatalogFilterDrawer>
    </main>
  )
}

export default TheArchiveClient
