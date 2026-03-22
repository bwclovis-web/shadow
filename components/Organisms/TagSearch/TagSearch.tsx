import { type VariantProps } from "class-variance-authority"
import type { ChangeEvent } from "react"
import { type FC, type HTMLProps, useCallback, useEffect, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import type { Tag } from "@/lib/queries/tags"
import { highlightSearchTerm } from "@/utils/highlightSearchTerm"
import { styleMerge } from "@/utils/styleUtils"

import CreateTagButton from "./Partials/CreateTagButton"
import { TagList } from "./Partials/TagList"
import { tagSearchVariants } from "./tagsearch-variants"

const TAG_SEARCH_API = "/api/getTag"

export type TagSearchSurface = "light" | "dark"
export type TagSearchSelectedLayout = "footer" | "flow"

interface TagSearchProps
  extends Omit<HTMLProps<HTMLDivElement>, "onChange" | "data">,
    VariantProps<typeof tagSearchVariants> {
  onChange?: (tags: Tag[]) => void
  label?: string
  data?: Tag[]
  allowCreate?: boolean
  /** When set, blocks adding tags beyond this count (existing tags can still be removed). */
  maxSelections?: number
  /** Defaults to `tag-search`. Use unique ids when multiple instances are mounted. */
  inputId?: string
  /** Label for the search input; defaults to `{label} search` or "Search". */
  searchInputLabel?: string
  /** footer: tag strip pinned to bottom (default). flow: tags stack under input (e.g. scent quiz). */
  selectedLayout?: TagSearchSelectedLayout
  /** dark: stone surfaces for dropdown and list (e.g. customer-facing pages). */
  surface?: TagSearchSurface
}

const dropdownItemClassesLight =
  "p-2 hover:bg-noir-gray hover:text-noir-light cursor-pointer last-of-type:rounded-b-md"

const dropdownItemClassesDark =
  "p-2 cursor-pointer text-noir-gold-100 last-of-type:rounded-b-md hover:bg-stone-700"

const TagSearch: FC<TagSearchProps> = ({
  className,
  onChange,
  label,
  data,
  allowCreate = true,
  maxSelections,
  inputId = "tag-search",
  searchInputLabel,
  selectedLayout = "footer",
  surface = "light",
}) => {
  const initialTags = Array.isArray(data) ? data : []
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags)

  useEffect(() => {
    if (!Array.isArray(data)) return
    setSelectedTags(prev => {
      const prevIds = prev.map(t => t.id).join("\0")
      const nextIds = data.map(t => t.id).join("\0")
      return prevIds === nextIds ? prev : data
    })
  }, [data])

  const searchFunction = useCallback(async (query: string) => {
    const res = await fetch(`${TAG_SEARCH_API}?tag=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error("Tag search request failed")
    return (await res.json()) as Tag[]
  }, [])

  const {
    searchValue: inputValue,
    setSearchValue: setInputValue,
    results,
    isLoading,
    error,
    clearResults,
  } = useDebouncedSearch(searchFunction, { delay: 300, minLength: 1 })

  const showDropdown =
    results.length > 0 ||
    isLoading ||
    !!error ||
    (inputValue.length >= 1 && results.length === 0)

  const closeDropdown = useCallback(() => {
    setInputValue("")
    clearResults()
  }, [clearResults, setInputValue])

  const handleItemClick = (item: Tag | { id: string; name?: string }) => {
    if (selectedTags.some(t => t.id === item.id)) return
    if (maxSelections != null && selectedTags.length >= maxSelections) return
    const tag: Tag = { id: item.id, name: item.name ?? "" }
    const newTags = [...selectedTags, tag]
    setSelectedTags(newTags)
    onChange?.(newTags)
    closeDropdown()
  }

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(tag => tag.id !== tagId)
    setSelectedTags(newTags)
    onChange?.(newTags)
  }

  const handleInputChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setInputValue(evt.target.value)
  }

  const searchLabel =
    searchInputLabel ?? (label ? `${label} search` : "Search")
  const isDark = surface === "dark"
  const dropdownUl = styleMerge(
    "w-full absolute z-10 rounded-b-md border shadow-lg",
    isDark
      ? "border-stone-600 bg-stone-800 text-noir-gold-100"
      : "border-transparent bg-white"
  )
  const itemRowClass = isDark ? dropdownItemClassesDark : dropdownItemClassesLight
  const mutedText = isDark ? "text-stone-400" : "text-gray-500"
  const pulseText = isDark ? "text-noir-gold-300" : undefined

  return (
    <div
      className={styleMerge(
        tagSearchVariants({ className }),
        selectedLayout === "flow" && "min-h-0"
      )}
      data-cy="TagSearch"
    >
      <div className={styleMerge("flex flex-col", selectedLayout === "flow" ? "mb-2" : "mb-6")}>
        <label htmlFor={inputId} className="block-label">
          {searchLabel}
        </label>
        <Input
          shading
          autoComplete="off"
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
        />
        {showDropdown && (
          <ul className={dropdownUl}>
            {isLoading && (
              <li className="p-2 text-center">
                <span className={styleMerge("animate-pulse", pulseText)}>
                  Searching...
                </span>
              </li>
            )}
            {error && (
              <li className="p-2 text-center text-red-400">
                <span>Search error: {error}</span>
              </li>
            )}
            {!isLoading &&
              !error &&
              results.map((item: Tag) => (
                <li key={item.id} className={itemRowClass}>
                  <Button
                    className="block h-full w-full text-left"
                    type="button"
                    onClick={() => handleItemClick(item)}
                  >
                    {highlightSearchTerm(item.name, inputValue)}
                  </Button>
                </li>
              ))}
            {!isLoading &&
              !error &&
              results.length === 0 &&
              inputValue.length >= 1 && (
                <li className={styleMerge("p-2 text-center", mutedText)}>
                  <span>No tags found</span>
                </li>
              )}
            {allowCreate && (
              <li className={itemRowClass}>
                <CreateTagButton
                  action={handleItemClick}
                  setOpenDropdown={closeDropdown}
                />
              </li>
            )}
          </ul>
        )}
      </div>
      <TagList
        selectedTags={selectedTags}
        label={label}
        onRemoveTag={handleRemoveTag}
        layout={selectedLayout === "flow" ? "flow" : "footer"}
        surface={isDark ? "dark" : "light"}
      />
    </div>
  )
}

export default TagSearch
