import { type ChangeEvent, useRef } from "react"
import { useTranslation } from "react-i18next"
import { LuSearch, LuX } from "react-icons/lu"

import { styleMerge } from "~/utils/styleUtils"

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
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (evt: ChangeEvent<HTMLInputElement>) => {
    onChange(evt.target.value)
  }

  return (
    <div className={styleMerge("relative w-full", className)}>
      <div className="relative">
        <LuSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 text-noir-gold-100"
          size={20}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || t("common.search") || "Search..."}
          className="w-full bg-noir-black/90 px-2 pl-10 pr-4 py-2 transition-all duration-300 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-noir-gold-100 hover:text-noir-gold transition-colors"
            aria-label="Clear search"
          >
            <LuX size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

export default SearchInput

