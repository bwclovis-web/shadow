"use client"

import { type FC, useEffect, useId, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import { RemovableChip } from "@/components/Molecules/RemovableChip"
import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import { styleMerge } from "@/utils/styleUtils"

const FILTER_LABEL_CLASS =
  "!mb-1 !max-w-none !bg-transparent !p-0 text-sm font-medium capitalize text-noir-gold-100"

export type HouseOption = { id: string; name: string }

/** @deprecated Use HouseOption */
export type HouseAutocompleteOption = HouseOption

const searchPerfumeHouses = async (query: string): Promise<HouseOption[]> => {
  const res = await fetch(`/api/perfume-houses?name=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error("House search failed")
  const data = await res.json()
  return (Array.isArray(data) ? data : []) as HouseOption[]
}

type HouseTypeaheadFormProps = {
  variant?: "form"
  label?: string
  name: string
  defaultId?: string
  defaultName?: string
  className?: string
  onNameChange?: (name: string) => void
}

type HouseTypeaheadControlledProps = {
  variant: "controlled"
  selected: HouseOption | null
  onSelect: (house: HouseOption | null) => void
  inputId: string
  label: string
  clearLabel: string
  className?: string
  /**
   * `filter` — charcoal field + removable chip (Exchange drawer).
   * Default keeps the readonly selected field + Clear button.
   */
  tone?: "default" | "filter"
  placeholder?: string
  messages?: {
    loading: string
    empty: string
    formatError: (error: string) => string
  }
}

export type HouseTypeaheadProps = HouseTypeaheadFormProps | HouseTypeaheadControlledProps

const HouseTypeaheadForm = ({
  label,
  name,
  defaultId,
  defaultName,
  className,
  onNameChange,
}: HouseTypeaheadFormProps) => {
  const uid = useId()
  const fieldInputId = `house-typeahead-${uid}`
  const [text, setText] = useState(defaultName ?? "")
  const [selectedId, setSelectedId] = useState(defaultId ?? "")

  useEffect(() => {
    if (defaultName !== undefined) setText(defaultName)
    if (defaultId !== undefined) setSelectedId(defaultId)
  }, [defaultName, defaultId])

  return (
    <div className={styleMerge("relative w-full", className)}>
      <SearchTypeahead<HouseOption>
        inputId={fieldInputId}
        listboxId={`${fieldInputId}-listbox`}
        label={label ?? "House"}
        labelClassName={label ? undefined : "sr-only"}
        placeholder="Search for a perfume house..."
        searchFn={searchPerfumeHouses}
        minLength={2}
        delay={300}
        inputValue={text}
        onInputChange={(query: string) => {
          setText(query)
          onNameChange?.(query)
          if (selectedId) setSelectedId("")
        }}
        onSelect={(item: HouseOption) => {
          setText(item.name)
          setSelectedId(item.id)
          onNameChange?.(item.name)
        }}
        clearInputOnSelect={false}
        inputClassName={styleMerge(
          searchbarVariants({ size: "standard" }),
          selectedId && "!border-green-500/50"
        )}
        messages={{
          loading: "Searching…",
          empty: "No houses found",
          formatError: (err: string) => `Search error: ${err}`,
        }}
      />
      <input type="hidden" name={name} value={selectedId} />
      {selectedId ? (
        <p className="text-xs text-green-400 mt-1">✓ House selected</p>
      ) : null}
    </div>
  )
}

const HouseTypeaheadControlled: FC<HouseTypeaheadControlledProps> = ({
  selected,
  onSelect,
  inputId,
  label,
  clearLabel,
  className,
  tone = "default",
  placeholder,
  messages,
}) => {
  const searchMessages = messages ?? {
    loading: "Searching…",
    empty: "No matches found",
    formatError: (err: string) => err,
  }
  const isFilter = tone === "filter"

  if (isFilter) {
    return (
      <div className={styleMerge("relative flex flex-col gap-2", className)}>
        {selected ? (
          <ul className="flex flex-wrap gap-2" role="list" aria-label={label}>
            <RemovableChip
              visual="tag"
              tone="dark"
              label={selected.name}
              onRemove={() => onSelect(null)}
              removeAriaLabel={clearLabel}
              removeTitle={clearLabel}
            />
          </ul>
        ) : null}
        <SearchTypeahead<HouseOption>
          inputId={inputId}
          listboxId={`${inputId}-listbox`}
          label={label}
          labelClassName={FILTER_LABEL_CLASS}
          placeholder={placeholder}
          searchFn={searchPerfumeHouses}
          minLength={2}
          delay={300}
          defaultInputValue=""
          clearInputOnSelect
          onSelect={(item: HouseOption) =>
            onSelect({ id: item.id, name: item.name })
          }
          inputClassName={searchbarVariants({
            size: "filter",
            variant: "filter",
          })}
          messages={searchMessages}
        />
      </div>
    )
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
      <SearchTypeahead<HouseOption>
        inputId={inputId}
        listboxId={`${inputId}-listbox`}
        label={label}
        searchFn={searchPerfumeHouses}
        minLength={2}
        delay={300}
        defaultInputValue=""
        onSelect={(item: HouseOption) => onSelect({ id: item.id, name: item.name })}
        inputClassName={searchbarVariants({ size: "standard" })}
        messages={searchMessages}
      />
    </div>
  )
}

const HouseTypeahead = (props: HouseTypeaheadProps) => {
  if (props.variant === "controlled") {
    return <HouseTypeaheadControlled {...props} />
  }
  return <HouseTypeaheadForm {...props} />
}

export default HouseTypeahead
