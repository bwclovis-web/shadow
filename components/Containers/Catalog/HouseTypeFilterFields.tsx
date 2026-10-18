"use client"

import { useTranslations } from "next-intl"

import CheckBox from "@/components/Atoms/CheckBox/CheckBox"
import { FilterPanelSection } from "@/components/Molecules/FilterPanelSection"
import { HOUSE_TYPES, type HouseTypeKey } from "@/utils/catalog-params"

type HouseTypeFilterFieldsProps = {
  value: HouseTypeKey[]
  onChange: (next: HouseTypeKey[]) => void
}

const HouseTypeFilterFields = ({ value, onChange }: HouseTypeFilterFieldsProps) => {
  const t = useTranslations("allHouses")

  const toggle = (houseType: HouseTypeKey) =>
    onChange(
      value.includes(houseType)
        ? value.filter(v => v !== houseType)
        : HOUSE_TYPES.filter(v => v === houseType || value.includes(v))
    )

  return (
    <FilterPanelSection collapsible title={t("filters.typeTitle")}>
      <div className="flex flex-col gap-3">
        <CheckBox
          id="house-filter-type-all"
          labelPosition="right"
          labelSize="sm"
          label={t("houseTypes.all")}
          checked={value.length === 0}
          onChange={() => onChange([])}
        />
        {HOUSE_TYPES.map(houseType => (
          <CheckBox
            key={houseType}
            id={`house-filter-type-${houseType}`}
            labelPosition="right"
            labelSize="sm"
            label={t(`houseTypes.${houseType}`)}
            checked={value.includes(houseType)}
            onChange={() => toggle(houseType)}
          />
        ))}
      </div>
    </FilterPanelSection>
  )
}

export default HouseTypeFilterFields
