"use client"

import { type VariantProps } from "class-variance-authority"
import {
  type HTMLProps,
  useCallback,
} from "react"
import { useTranslations } from "next-intl"

import SearchTypeahead, {
  type TypeaheadItem,
} from "@/components/Molecules/SearchTypeahead"
import { useMounted } from "@/hooks/useMounted"
import { styleMerge } from "@/utils/styleUtils"

import { searchbarVariants } from "./searchbar-variants"

type SearchBarItem = TypeaheadItem & { slug: string }

interface SearchBarProps
  extends Omit<HTMLProps<HTMLDivElement>, "action">,
    VariantProps<typeof searchbarVariants> {
  searchType: "perfume-house" | "perfume"
  placeholder?: string
  action?: (item: SearchBarItem) => void
}

export default function SearchBar({
  className,
  searchType,
  action,
  placeholder,
  variant,
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

  return (
    <div className="relative w-full">
      <form className="flex gap-2" onSubmit={evt => evt.preventDefault()}>
        <SearchTypeahead<SearchBarItem>
          inputId="search"
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
          placement="portal"
          surface="hero"
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
        />
      </form>
    </div>
  )
}
