"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import AdSenseUnit from "@/components/Atoms/AdSenseUnit"
import { Button } from "@/components/Atoms/Button/Button"
import HouseTypeFilterFields from "@/components/Containers/Catalog/HouseTypeFilterFields"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import type { CatalogItemDisplay } from "@/components/Molecules/CatalogItem/CatalogItem"
import CatalogFilterDrawer from "@/components/Organisms/CatalogFilterDrawer/CatalogFilterDrawer"
import CatalogResults from "@/components/Organisms/CatalogResults/CatalogResults"
import CatalogToolbar from "@/components/Organisms/CatalogToolbar/CatalogToolbar"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { HOUSE_DETAIL_PATH } from "@/constants/routes"
import { useCatalogNavigation } from "@/hooks/useCatalogNavigation"
import type { CatalogHouseItem, CatalogPage } from "@/types/catalog"
import {
  buildHouseCatalogHref,
  HOUSE_SORTS,
  type HouseCatalogState,
  type HouseSort,
  type HouseTypeKey,
} from "@/utils/catalog-params"
import {
  houseImageTransitionName,
  houseTitleTransitionName,
} from "@/utils/view-transition-names"

const BANNER_IMAGE = "/images/new/behind.webp"
const FALLBACK_IMAGE = "/images/house-soon.webp"

interface AllHousesClientProps {
  heading: string
  subheading: string
  state: HouseCatalogState
  catalog: CatalogPage<CatalogHouseItem>
  showAds?: boolean
}

const AllHousesClient = ({
  heading,
  subheading,
  state,
  catalog,
  showAds = true,
}: AllHousesClientProps) => {
  const t = useTranslations("allHouses")
  const tCatalog = useTranslations("catalog")
  const { isPending, state: requested, navigate, prefetch } = useCatalogNavigation(state)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftTypes, setDraftTypes] = useState<HouseTypeKey[]>(state.houseTypes)

  const activeFilterCount = state.houseTypes.length
  const withPatch = (patch: Partial<HouseCatalogState>): HouseCatalogState => ({
    ...state,
    page: 1,
    ...patch,
  })
  const go = (next: HouseCatalogState, options?: { scrollToResults?: boolean }) =>
    navigate(buildHouseCatalogHref(next), next, options)

  const openFilters = () => {
    setDraftTypes(state.houseTypes)
    setFiltersOpen(true)
  }

  const applyFilters = () => {
    setFiltersOpen(false)
    go(withPatch({ houseTypes: draftTypes }))
  }

  const items: CatalogItemDisplay[] = catalog.items.map(house => ({
    id: house.id,
    href: state.letter
      ? `${HOUSE_DETAIL_PATH}/${house.slug}?letter=${state.letter}`
      : `${HOUSE_DETAIL_PATH}/${house.slug}`,
    title: house.name,
    subtitle: t(`houseTypes.${house.houseType}`),
    image: house.image,
    fallbackImage: FALLBACK_IMAGE,
    imageAlt: house.name,
    imageTransitionName: houseImageTransitionName(house.id),
    titleTransitionName: houseTitleTransitionName(house.id),
  }))

  const emptyState = (
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
          onClick={() => go(withPatch({ houseTypes: [] }))}
        >
          {tCatalog("clearFilters")}
        </Button>
      ) : null}
    </div>
  )

  return (
    <main id="main-content">
      <TitleBanner image={BANNER_IMAGE} heading={heading} subheading={subheading} />

      <PageWrapper className="space-y-6">
        <CatalogToolbar
          searchType="perfume-house"
          sortOptions={HOUSE_SORTS.map(sort => ({
            id: sort,
            name: sort,
            label: t(`sortOptions.${sort}`),
          }))}
          sort={requested.sort}
          onSortChange={sort => go(withPatch({ sort: sort as HouseSort }))}
          activeFilterCount={requested.houseTypes.length}
          onOpenFilters={openFilters}
          view={requested.view}
          onViewChange={view => go({ ...state, view })}
          letter={requested.letter}
          onLetterSelect={letter => go(withPatch({ letter }))}
          onLetterHover={letter => prefetch(buildHouseCatalogHref(withPatch({ letter })))}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            sort: tCatalog("toolbar.sort"),
            filters: tCatalog("toolbar.filters"),
            filtersAria: tCatalog("toolbar.filtersAria", {
              count: requested.houseTypes.length,
            }),
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
        />
      </PageWrapper>

      <CatalogFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("filters.title")}
        closeLabel={tCatalog("drawer.close")}
        clearLabel={tCatalog("drawer.clearAll")}
        applyLabel={tCatalog("drawer.apply", { count: draftTypes.length })}
        onClear={() => setDraftTypes([])}
        onApply={applyFilters}
      >
        <HouseTypeFilterFields value={draftTypes} onChange={setDraftTypes} />
      </CatalogFilterDrawer>
    </main>
  )
}

export default AllHousesClient
