import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select/Select"
import SearchBar from "@/components/Organisms/SearchBar/SearchBar"
import { styleMerge } from "@/utils/styleUtils"
import { type SortOption } from "@/utils/sortUtils"

export interface FilterOption {
  id: string
  value: string
  label: string
  name: string
  defaultChecked: boolean
}

interface DataFiltersProps {
  searchType: "perfume-house" | "perfume"
  sortOptions: FilterOption[]
  typeOptions?: FilterOption[]
  selectedSort: SortOption
  selectedType?: string
  onSortChange: (evt: { target: { value: string } }) => void
  onTypeChange?: (evt: { target: { value: string } }) => void
  className?: string
}

const DataFilters = ({
  searchType,
  sortOptions,
  typeOptions,
  selectedSort,
  selectedType,
  onSortChange,
  onTypeChange,
  className,
}: DataFiltersProps) => {
  const t = useTranslations("components")

  const showTypeFilter = typeOptions != null && onTypeChange != null

  return (
    <div
      className={styleMerge(
        "lg:p-4 flex flex-col gap-6 lg:flex-row md:justify-between md:items-center noir-border",
        className
      )}
    >
      <div className="w-full mb-0">
        <SearchBar searchType={searchType} variant="animated" />
      </div>

      <div className="flex gap-6 w-full lg:w-3/4 justify-start lg:justify-end items-end md:items-center">
        {showTypeFilter && (
          <Select
            selectData={typeOptions}
            action={onTypeChange}
            className="flex-wrap w:1/2"
            selectId={`${searchType}-type`}
            defaultId={selectedType}
            label={t("filter.heading")}
          />
        )}

        <Select
          selectData={sortOptions}
          action={onSortChange}
          className="flex-wrap w:1/2"
          selectId={`${searchType}-sort`}
          defaultId={selectedSort}
          label={t("sort.heading")}
        />
      </div>
    </div>
  )
}

export default DataFilters
