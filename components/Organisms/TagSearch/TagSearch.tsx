import { type VariantProps } from "class-variance-authority"
import { type FC, type HTMLProps, useCallback, useEffect, useState } from "react"

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

interface TagSearchProps
  extends Omit<HTMLProps<HTMLDivElement>, "onChange" | "data">,
    VariantProps<typeof tagSearchVariants> {
  onChange?: (tags: Tag[]) => void
  label?: string
  data?: Tag[]
  allowCreate?: boolean
  maxSelections?: number
  inputId?: string
  searchInputLabel?: string
  selectedLayout?: TagSearchSelectedLayout
  surface?: TagSearchSurface
}

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
  const isDark = surface === "dark"
  const surfaceKey = isDark ? "dark" : "light"
  const itemRowClass = typeaheadItemRowClasses[surfaceKey]

  return (
    <div
      className={styleMerge(
        tagSearchVariants({ className }),
        selectedLayout === "flow" && "min-h-0"
      )}
      data-cy="TagSearch"
    >
      <div
        className={styleMerge(
          "flex flex-col",
          selectedLayout === "flow" ? "mb-2" : "mb-6"
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
          placement="inline"
          surface={surfaceKey}
          useShadedInput
          messages={{
            loading: "Searching...",
            empty: "No tags found",
            formatError: err => `Search error: ${err}`,
          }}
          footerSlot={
            allowCreate
              ? ({ clearList }: { clearList: () => void }) => (
                  <li className={itemRowClass}>
                    <CreateTagButton
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
        surface={isDark ? "dark" : "light"}
      />
    </div>
  )
}

export default TagSearch
