import { useTranslation } from "react-i18next"

import Select from "~/components/Atoms/Select"
import SearchBar from "~/components/Organisms/SearchBar"
import { type SortOption } from "~/utils/sortUtils"

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
  className = "",
}: DataFiltersProps) => {
  const { t } = useTranslation()
  return (
    <div className="p-4 pb-0 md:pb-4">
      <div
        className={`space-y-6 inner-container py-4 flex flex-col gap-6 md:flex-row md:justify-between md:items-center noir-border ${className}`}
      >
        <div className="w-full lg:w-1/4 mb-0">
          <SearchBar searchType={searchType} variant="animated" />
        </div>

        <div className="flex gap-6 w-full md:w-3/4 justify-between md:justify-end items-end md:items-center">
          {typeOptions && onTypeChange && (
            <div>
              <Select
                selectData={typeOptions}
                action={onTypeChange}
                className="flex-wrap"
                selectId={`${searchType}-type`}
                defaultId={selectedType}
                label={t("components.filter.heading")}
              />
            </div>
          )}

          <div>
            <Select
              selectData={sortOptions}
              action={onSortChange}
              className="flex-wrap"
              selectId={`${searchType}-sort`}
              defaultId={selectedSort}
              label={t("components.sort.heading")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataFilters
