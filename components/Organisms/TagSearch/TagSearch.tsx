import { type HTMLProps, useCallback, useEffect, useState } from "react"

import SearchTypeahead from "@/components/Molecules/SearchTypeahead"
import { typeaheadItemRowClasses } from "@/components/Molecules/SearchTypeahead/search-typeahead-surfaces"
import type { Tag } from "@/lib/queries/tags"
import { styleMerge } from "@/utils/styleUtils"

import CreateTagButton from "./Partials/CreateTagButton"
import { TagList } from "./Partials/TagList"
import { tagSearchVariants } from "./tagsearch-variants"

const TAG_SEARCH_API = "/api/getTag"

export type TagSearchSurface = "light" | "dark"
export type TagSearchSelectedLayout = "footer" | "flow"

interface TagSearchProps extends Omit<HTMLProps<HTMLDivElement>, "onChange" | "data"> {
  onChange?: (tags: Tag[]) => void
  label?: string
  data?: Tag[]
  allowCreate?: boolean
  maxSelections?: number
  inputId?: string
  searchInputLabel?: string
  selectedLayout?: TagSearchSelectedLayout
  surface?: TagSearchSurface
  /**
   * Suggestion list layering. Default `portal` keeps the list above adjacent grid
   * columns and stacked cards (inline would sit under the next column’s cards).
   * Pass `inline` only in a single-column layout where nothing can overlap the panel.
   */
  typeaheadPlacement?: "inline" | "portal"
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
  selectedLayout = "footer",
  surface = "light",
  typeaheadPlacement,
}: TagSearchProps) => {
  const resolvedTypeaheadPlacement = typeaheadPlacement ?? "portal"
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
  const surfaceKey = surface === "dark" ? "dark" : "light"
  const layoutKey = selectedLayout === "flow" ? "flow" : "footer"
  const itemRowClass = typeaheadItemRowClasses[surfaceKey]
  const createFieldId = `${inputId}-create`

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
          selectedLayout === "flow" ? "gap-2" : "gap-1"
        )}
      >
        <SearchTypeahead<Tag>
          inputId={inputId}
          listboxId={`${inputId}-listbox`}
          label={searchLabel}
          searchFn={searchFunction}
          minLength={1}
          delay={300}
          defaultInputValue=""
          onSelect={(item: Tag) => {
            handleItemClick(item)
          }}
          clearInputOnSelect
          placement={resolvedTypeaheadPlacement}
          surface={surfaceKey}
          useShadedInput
          messages={{
            loading: "Searching…",
            empty: "No tags found",
            formatError: err => `Search error: ${err}`,
          }}
          footerSlot={
            allowCreate
              ? ({ clearList }: { clearList: () => void }) => (
                  <li className={itemRowClass}>
                    <CreateTagButton
                      createInputId={createFieldId}
                      surface={surfaceKey}
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
      <TagList
        selectedTags={selectedTags}
        label={label}
        onRemoveTag={handleRemoveTag}
        layout={selectedLayout === "flow" ? "flow" : "footer"}
        surface={surfaceKey}
      />
    </div>
  )
}

export default TagSearch
