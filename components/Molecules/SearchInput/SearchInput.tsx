import { type ChangeEvent } from "react"
import { useTranslations } from "next-intl"
import { LuSearch, LuX } from "react-icons/lu"

import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import { styleMerge } from "@/utils/styleUtils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const SearchInput = ({
  value,
  onChange,
  placeholder,
  className,
}: SearchInputProps) => {
  const t = useTranslations("common")

  const handleChange = (evt: ChangeEvent<HTMLInputElement>) => {
    onChange(evt.target.value)
  }

  return (
    <div
      role="search"
      className={styleMerge("relative w-full", className)}
    >
      <LuSearch
        className="absolute left-3 top-1/2 -translate-y-1/2 text-noir-gold-100 pointer-events-none"
        size={20}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? t("search")}
        className={styleMerge(
          searchbarVariants({ size: "standard" }),
          "pl-10 pr-10 outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"
        )}
        aria-label={t("search")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-noir-gold-100 hover:text-noir-gold transition-colors"
          aria-label={t("clearSearch")}
        >
          <LuX size={18} />
        </button>
      )}
    </div>
  )
}

export default SearchInput

