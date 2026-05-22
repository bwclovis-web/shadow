"use client"

import { useEffect, useId, useState } from "react"
import { useTranslations } from "next-intl"

import { CountryFlagBadge } from "@/components/Molecules/CountryFlagBadge"
import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import {
  getCountryById,
  resolveTraderCountry,
  searchCountries,
  type CountryEntry,
} from "@/utils/country-list"
import { styleMerge } from "@/utils/styleUtils"

export type CountryOption = CountryEntry

type CountryTypeaheadProps = {
  name: string
  label?: string
  defaultValue?: string | null
  className?: string
  onChange?: (countryId: string) => void
}

const CountryTypeahead = ({
  name,
  label,
  defaultValue,
  className,
  onChange,
}: CountryTypeaheadProps) => {
  const t = useTranslations("profile")
  const uid = useId()
  const fieldInputId = `country-typeahead-${uid}`

  const resolvedDefault = resolveTraderCountry(defaultValue)
  const initialCountry = defaultValue ? getCountryById(defaultValue) : null
  const initialText =
    resolvedDefault?.name ?? initialCountry?.name ?? defaultValue ?? ""

  const [text, setText] = useState(initialText)
  const [selectedId, setSelectedId] = useState(
    initialCountry?.id ?? getCountryById(defaultValue ?? "")?.id ?? ""
  )

  useEffect(() => {
    const country = defaultValue ? getCountryById(defaultValue) : null
    const resolved = resolveTraderCountry(defaultValue)
    setText(resolved?.name ?? country?.name ?? defaultValue ?? "")
    setSelectedId(country?.id ?? "")
  }, [defaultValue])

  const searchFn = async (query: string): Promise<CountryOption[]> =>
    searchCountries(query)

  const selectedCountry = selectedId ? getCountryById(selectedId) : null

  return (
    <div className={styleMerge("relative w-full", className)}>
      <SearchTypeahead<CountryOption>
        inputId={fieldInputId}
        listboxId={`${fieldInputId}-listbox`}
        label={label ?? t("region")}
        placeholder={t("regionPlaceholder")}
        searchFn={searchFn}
        minLength={1}
        delay={150}
        initialDismissed
        inputValue={text}
        onInputChange={(query) => {
          setText(query)
          if (selectedId) {
            setSelectedId("")
            onChange?.("")
          }
        }}
        onSelect={(item) => {
          setText(item.name)
          setSelectedId(item.id)
          onChange?.(item.id)
        }}
        clearInputOnSelect={false}
        optionMode="action"
        inputClassName={styleMerge(
          searchbarVariants({ size: "standard" }),
          selectedId && "!border-green-500/50"
        )}
        messages={{
          loading: t("countrySearchLoading"),
          empty: t("countrySearchEmpty"),
          formatError: (err) => t("countrySearchError", { error: err }),
        }}
        renderOption={(item, { highlighted }) => (
          <span className="flex items-center gap-2 min-w-0">
            <CountryFlagBadge code={item.code} size="sm" />
            <span className="min-w-0 truncate">{highlighted}</span>
          </span>
        )}
      />
      <input type="hidden" name={name} value={selectedId} />
      {selectedCountry ? (
        <p className="text-xs text-green-400 mt-1 flex items-center gap-1.5">
          <CountryFlagBadge code={selectedCountry.code} size="sm" />
          <span>{t("countrySelected", { country: selectedCountry.name })}</span>
        </p>
      ) : null}
    </div>
  )
}

export default CountryTypeahead
