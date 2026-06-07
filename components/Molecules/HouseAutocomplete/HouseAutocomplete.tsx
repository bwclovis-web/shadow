"use client"

import HouseTypeahead, {
  type HouseOption,
} from "@/components/Molecules/HouseTypeahead/HouseTypeahead"

export type HouseAutocompleteOption = HouseOption

export type HouseAutocompleteProps = {
  selected: HouseAutocompleteOption | null
  onSelect: (house: HouseAutocompleteOption | null) => void
  inputId: string
  label: string
  clearLabel: string
  className?: string
}

/** @deprecated Use HouseTypeahead with variant="controlled" */
export const HouseAutocomplete = (props: HouseAutocompleteProps) => (
  <HouseTypeahead variant="controlled" {...props} />
)
