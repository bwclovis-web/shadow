"use client"

import { type HTMLProps, useCallback, useEffect, useState } from "react"

import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { typeaheadItemRowClass } from "@/components/Molecules/SearchTypeahead/search-typeahead-surfaces"
import { searchbarVariants } from "@/components/Molecules/SearchTypeahead/searchbar-variants"
import type { Tag } from "@/lib/queries/tags"
import { styleMerge } from "@/utils/styleUtils"

import CreateTagButton from "./Partials/CreateTagButton"
import { TagList } from "./Partials/TagList"
import { tagSearchVariants } from "./tagsearch-variants"

const TAG_SEARCH_API = "/api/getTag"

export type TagSearchSurface = "light" | "dark" | "plain"
export type TagSearchSelectedLayout = "footer" | "flow" | "none"

interface TagSearchProps extends Omit<HTMLProps<HTMLDivElement>, "onChange" | "data"> {
  onChange?: (tags: Tag[]) => void
  label?: string
  data?: Tag[]
  allowCreate?: boolean
  maxSelections?: number
  inputId?: string
  searchInputLabel?: string
  searchLabelClassName?: string
  selectedLayout?: TagSearchSelectedLayout
  surface?: TagSearchSurface
  /** Defaults to note-tag search (`/api/getTag`). */
  searchFn?: (query: string) => Promise<Tag[]>
  messages?: { loading: string; empty: string; formatError: (err: string) => string }
  placeholder?: string
  /** Replaces the default empty-selection copy in the `flow` layout. */
  emptyLabel?: string
}

const DEFAULT_MESSAGES = {
  loading: "Searching…",
  empty: "No tags found",
  formatError: (err: string) => `Search error: ${err}`,
}

const TagSearch = ({
  className,
  onChange,
  label,
  data,
  allowCreate = true,
  maxSelections,
  inputId = "tag-search",
  searchInputLabel,
  searchLabelClassName,
  selectedLayout = "footer",
  surface = "light",
  searchFn,
  messages = DEFAULT_MESSAGES,
  placeholder,
  emptyLabel,
}: TagSearchProps) => {
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

  const searchTags = useCallback(async (query: string) => {
    const res = await fetch(`${TAG_SEARCH_API}?tag=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error("Tag search request failed")
    return (await res.json()) as Tag[]
  }, [])
  const searchFunction = searchFn ?? searchTags

  const handleItemClick = (item: Tag | { id: string; name?: string }) => {
    if (selectedTags.some(t => t.id === item.id)) return
    if (maxSelections != null && selectedTags.length >= maxSelections) return
    const tag: Tag = { id: item.id, name: item.name ?? "" }
    const newTags = [...selectedTags, tag]
    setSelectedTags(newTags)
    onChange?.(newTags)
  }

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(tag => tag.id !== tagId)
    setSelectedTags(newTags)
    onChange?.(newTags)
  }

  const searchLabel =
    searchInputLabel ?? (label ? `${label} search` : "Search")
  const surfaceKey =
    surface === "dark" ? "dark" : surface === "plain" ? "plain" : "light"
  const layoutKey =
    selectedLayout === "flow"
      ? "flow"
      : selectedLayout === "none"
        ? "none"
        : "footer"
  const createFieldId = `${inputId}-create`
  const listSurface = surfaceKey === "plain" ? "dark" : surfaceKey

  return (
    <div
      className={styleMerge(
        tagSearchVariants({ surface: surfaceKey, layout: layoutKey }),
        className
      )}
      data-cy="TagSearch"
    >
      <div
        className={styleMerge(
          "relative z-20 flex min-h-0 flex-col",
          selectedLayout === "footer" ? "gap-1" : "gap-2"
        )}
      >
        <SearchTypeahead<Tag>
          inputId={inputId}
          listboxId={`${inputId}-listbox`}
          label={searchLabel}
          labelClassName={searchLabelClassName}
          searchFn={searchFunction}
          minLength={2}
          delay={300}
          defaultInputValue=""
          onSelect={(item: Tag) => {
            handleItemClick(item)
          }}
          clearInputOnSelect
          placeholder={placeholder}
          inputClassName={searchbarVariants({ size: "standard" })}
          messages={messages}
          footerSlot={
            allowCreate
              ? ({ clearList }: { clearList: () => void }) => (
                  <li className={typeaheadItemRowClass}>
                    <CreateTagButton
                      createInputId={createFieldId}
                      action={handleItemClick}
                      setOpenDropdown={open => {
                        if (!open) clearList()
                      }}
                    />
                  </li>
                )
              : undefined
          }
        />
      </div>
      {selectedLayout === "none" ? null : (
        <TagList
          type="exchange"
          selectedTags={selectedTags}
          label={label}
          onRemoveTag={handleRemoveTag}
          layout={selectedLayout === "flow" ? "flow" : "footer"}
          surface={listSurface}
          emptyLabel={emptyLabel}
        />
      )}
    </div>
  )
}

export default TagSearch
