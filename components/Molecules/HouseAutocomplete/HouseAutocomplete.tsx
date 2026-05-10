"use client"

import { type FC } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import { styleMerge } from "@/utils/styleUtils"

export type HouseAutocompleteOption = { id: string; name: string }

export type HouseAutocompleteProps = {
  selected: HouseAutocompleteOption | null
  onSelect: (house: HouseAutocompleteOption | null) => void
  inputId: string
  label: string
  clearLabel: string
  className?: string
}

export const HouseAutocomplete: FC<HouseAutocompleteProps> = ({
  selected,
  onSelect,
  inputId,
  label,
  clearLabel,
  className,
}) => {
  const searchFn = async (query: string) => {
    const res = await fetch(
      `/api/perfume-houses?name=${encodeURIComponent(query)}`
    )
    if (!res.ok) throw new Error("House search failed")
    return (await res.json()) as HouseAutocompleteOption[]
  }

  if (selected) {
    return (
      <div className={styleMerge("relative", className)}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            type="text"
            readOnly
            value={selected.name}
            className={styleMerge(
              searchbarVariants({ size: "standard" }),
              "cursor-default capitalize"
            )}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSelect(null)}
          >
            {clearLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styleMerge("relative", className)}>
      <SearchTypeahead<HouseAutocompleteOption>
        inputId={inputId}
        listboxId={`${inputId}-listbox`}
        label={label}
        searchFn={searchFn}
        minLength={2}
        delay={300}
        defaultInputValue=""
        onSelect={(item: HouseAutocompleteOption) =>
          onSelect({ id: item.id, name: item.name })
        }
        inputClassName={searchbarVariants({ size: "standard" })}
        messages={{
          loading: "…",
          empty: "—",
          formatError: (err: string) => err,
        }}
      />
    </div>
  )
}
