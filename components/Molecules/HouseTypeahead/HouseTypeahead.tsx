"use client"

import { useEffect, useId, useState } from "react"

import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import { styleMerge } from "@/utils/styleUtils"

type PerfumeHouseOption = { id: string; name: string }

interface HouseTypeaheadProps {
  label?: string
  name: string
  defaultId?: string
  defaultName?: string
  className?: string
  onNameChange?: (name: string) => void
}

const HouseTypeahead = ({
  label,
  name,
  defaultId,
  defaultName,
  className,
  onNameChange,
}: HouseTypeaheadProps) => {
  const uid = useId()
  const fieldInputId = `house-typeahead-${uid}`
  const [text, setText] = useState(defaultName ?? "")
  const [selectedId, setSelectedId] = useState(defaultId ?? "")

  useEffect(() => {
    if (defaultName !== undefined) setText(defaultName)
    if (defaultId !== undefined) setSelectedId(defaultId)
  }, [defaultName, defaultId])

  const searchFn = async (query: string) => {
    const res = await fetch(`/api/perfume-houses?name=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error("House search failed")
    const data = await res.json()
    return (Array.isArray(data) ? data : []) as PerfumeHouseOption[]
  }

  return (
    <div className={styleMerge("relative w-full", className)}>
      <SearchTypeahead<PerfumeHouseOption>
        inputId={fieldInputId}
        listboxId={`${fieldInputId}-listbox`}
        label={label ?? "House"}
        labelClassName={label ? undefined : "sr-only"}
        placeholder="Search for a perfume house..."
        searchFn={searchFn}
        minLength={2}
        delay={300}
        inputValue={text}
        onInputChange={(query: string) => {
          setText(query)
          onNameChange?.(query)
          if (selectedId) setSelectedId("")
        }}
        onSelect={(item: PerfumeHouseOption) => {
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

export default HouseTypeahead
