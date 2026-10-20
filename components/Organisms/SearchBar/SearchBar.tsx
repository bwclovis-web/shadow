"use client"

import { type VariantProps } from "class-variance-authority"
import {
  type FormEvent,
  type HTMLProps,
  type ReactNode,
  useCallback,
} from "react"
import { useTranslations } from "next-intl"

import SearchTypeahead, {
  type TypeaheadItem,
} from "@/components/Molecules/SearchTypeahead"
import ReviewStatusBadge from "@/components/Atoms/ReviewStatusBadge"
import { useMounted } from "@/hooks/useMounted"
import { styleMerge } from "@/utils/styleUtils"

import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"

type SearchBarItem = TypeaheadItem & { slug: string; isPending?: boolean }

interface SearchBarProps
  extends Omit<HTMLProps<HTMLDivElement>, "action" | "size">,
    VariantProps<typeof searchbarVariants> {
  searchType: "perfume-house" | "perfume"
  placeholder?: string
  action?: (item: SearchBarItem) => void
  autoFocus?: boolean
  footerSlot?: ReactNode | ((ctx: { clearList: () => void }) => ReactNode)
  /** Defaults to `"search"`. Use a unique id when multiple search bars share a page. */
  inputId?: string
  inputValue?: string
  onInputChange?: (value: string) => void
  defaultInputValue?: string
  clearInputOnSelect?: boolean
  disabled?: boolean
  /**
   * Commit free-text query on Enter (when no typeahead row is highlighted).
   * Used by filter surfaces (Seeking); Archive/Houses leave this unset and navigate via links.
   */
  onQueryCommit?: (query: string) => void
}

export default function SearchBar({
  className,
  searchType,
  action,
  placeholder,
  variant,
  autoFocus,
  footerSlot,
  inputId = "search",
  inputValue,
  onInputChange,
  defaultInputValue,
  clearInputOnSelect,
  disabled,
  onQueryCommit,
}: SearchBarProps) {
  const tCommon = useTranslations("common")
  const tHome = useTranslations("home")
  const mounted = useMounted()

  const searchFunction = useCallback(
    async (query: string) => {
      const url =
        searchType === "perfume-house" ? "/api/perfume-houses" : "/api/perfume"
      const res = await fetch(`${url}?name=${encodeURIComponent(query)}`)
      if (!res.ok) {
        throw new Error("Search request failed")
      }
      return (await res.json()) as SearchBarItem[]
    },
    [searchType]
  )

  const getOptionHref = useCallback(
    (item: SearchBarItem) =>
      searchType === "perfume-house"
        ? `/houses/${item.slug}`
        : `/perfume/${item.slug}`,
    [searchType]
  )

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault()
    if (!onQueryCommit) return
    const form = evt.currentTarget
    const input = form.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`)
    onQueryCommit(input?.value ?? "")
  }

  return (
    <div className="relative w-full">
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <SearchTypeahead<SearchBarItem>
          inputId={inputId}
          label={mounted ? tCommon("search") : "Search"}
          labelClassName="sr-only"
          placeholder={
            placeholder ??
            (mounted
              ? `${tCommon("search")} ${tHome(`searchType.${searchType}`)}`
              : "Search")
          }
          searchFn={searchFunction}
          minLength={2}
          delay={300}
          inputValue={inputValue}
          onInputChange={onInputChange}
          defaultInputValue={defaultInputValue}
          clearInputOnSelect={clearInputOnSelect}
          disabled={disabled}
          inputClassName={styleMerge(searchbarVariants({ className, variant }))}
          onSelect={action}
          getOptionHref={action ? undefined : getOptionHref}
          optionMode={action ? "action" : "link"}
          messages={{
            loading: mounted ? tCommon("loading") : "Loading...",
            empty: mounted ? tCommon("noResultsFound") : "No results found",
            formatError: (err: string) =>
              mounted ? tCommon("searchError", { error: err }) : `Error: ${err}`,
          }}
          footerSlot={footerSlot}
          autoFocus={autoFocus}
          renderOption={
            searchType === "perfume"
              ? (item, { highlighted }) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{highlighted}</span>
                    {item.isPending ? <ReviewStatusBadge /> : null}
                  </span>
                )
              : undefined
          }
        />
      </form>
    </div>
  )
}
