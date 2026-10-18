"use client"

import { useTranslations } from "next-intl"

import CheckBox from "@/components/Atoms/CheckBox/CheckBox"
import { FilterPanelSection } from "@/components/Molecules/FilterPanelSection"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import type { CatalogOption } from "@/types/catalog"
import { SEASON_KEYS, type SeasonKey } from "@/types/perfume-season-vote"
import { CATALOG_MAX_SELECTIONS } from "@/utils/catalog-params"

export type ArchiveFilterDraft = {
  houses: CatalogOption[]
  notes: CatalogOption[]
  seasons: SeasonKey[]
}

export const countArchiveFilterDraft = (draft: ArchiveFilterDraft): number =>
  draft.houses.length + draft.notes.length + draft.seasons.length

const searchHouses = async (query: string): Promise<CatalogOption[]> => {
  const res = await fetch(`/api/perfume-houses?name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error("House search failed")
  const data: unknown = await res.json()
  return Array.isArray(data)
    ? data.map(({ id, name }: CatalogOption) => ({ id, name }))
    : []
}

const toOptions = (tags: { id: string; name: string }[]): CatalogOption[] =>
  tags.map(({ id, name }) => ({ id, name }))

type ArchiveFilterFieldsProps = {
  value: ArchiveFilterDraft
  onChange: (next: ArchiveFilterDraft) => void
}

const ArchiveFilterFields = ({ value, onChange }: ArchiveFilterFieldsProps) => {
  const t = useTranslations("allPerfumes.filters")
  const tCatalog = useTranslations("catalog.filters")
  const tSeason = useTranslations("singlePerfume.seasonVote.season")

  const searchMessages = {
    loading: tCatalog("searching"),
    empty: tCatalog("noMatches"),
    formatError: () => tCatalog("searchError"),
  }

  const toggleSeason = (season: SeasonKey) =>
    onChange({
      ...value,
      seasons: value.seasons.includes(season)
        ? value.seasons.filter(s => s !== season)
        : SEASON_KEYS.filter(s => s === season || value.seasons.includes(s)),
    })

  return (
    <>
      <FilterPanelSection collapsible title={t("house")}>
        <TagSearch
          inputId="archive-filter-house"
          label={t("selectedHouses")}
          searchInputLabel={t("houseSearch")}
          searchLabelClassName="sr-only"
          placeholder={t("houseSearchPlaceholder")}
          searchFn={searchHouses}
          messages={searchMessages}
          emptyLabel={t("noHousesSelected")}
          allowCreate={false}
          maxSelections={CATALOG_MAX_SELECTIONS}
          surface="dark"
          selectedLayout="flow"
          data={value.houses}
          onChange={tags => onChange({ ...value, houses: toOptions(tags) })}
        />
      </FilterPanelSection>

      <FilterPanelSection collapsible title={t("notes")}>
        <TagSearch
          inputId="archive-filter-notes"
          label={t("selectedNotes")}
          searchInputLabel={t("noteSearch")}
          searchLabelClassName="sr-only"
          placeholder={t("noteSearchPlaceholder")}
          messages={searchMessages}
          emptyLabel={t("noNotesSelected")}
          allowCreate={false}
          maxSelections={CATALOG_MAX_SELECTIONS}
          surface="dark"
          selectedLayout="flow"
          data={value.notes}
          onChange={tags => onChange({ ...value, notes: toOptions(tags) })}
        />
      </FilterPanelSection>

      <FilterPanelSection
        collapsible
        title={t("season")}
        description={t("seasonDescription")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEASON_KEYS.map(season => (
            <CheckBox
              key={season}
              id={`archive-filter-season-${season}`}
              labelPosition="right"
              labelSize="sm"
              label={tSeason(season)}
              checked={value.seasons.includes(season)}
              onChange={() => toggleSeason(season)}
            />
          ))}
        </div>
      </FilterPanelSection>
    </>
  )
}

export default ArchiveFilterFields
