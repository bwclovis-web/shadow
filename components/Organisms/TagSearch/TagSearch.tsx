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

const dropdownItemClasses =
  "p-2 hover:bg-noir-gray hover:text-noir-light cursor-pointer last-of-type:rounded-b-md"

interface TagSearchProps
  extends Omit<HTMLProps<HTMLDivElement>, "onChange" | "data">,
    VariantProps<typeof tagSearchVariants> {
  onChange?: (tags: Tag[]) => void
  label?: string
  data?: Tag[]
  allowCreate?: boolean
}

const TagSearch: FC<TagSearchProps> = ({
  className,
  onChange,
  label,
  data,
  allowCreate = true,
}) => {
  const initialTags = Array.isArray(data) ? data : []
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags)

  useEffect(() => {
    if (Array.isArray(data)) {
      setSelectedTags(data)
    }
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

  const handleItemClick = (item: Tag | { id: string; name?: string }) => {
    if (selectedTags.some(t => t.id === item.id)) return
    const tag: Tag = { id: item.id, name: item.name ?? "" }
    const newTags = [...selectedTags, tag]
    setSelectedTags(newTags)
    onChange?.(newTags)
    clearResults()
  }

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter(tag => tag.id !== tagId)
    setSelectedTags(newTags)
    onChange?.(newTags)
  }

  const handleInputChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setInputValue(evt.target.value)
  }

  const searchLabel = label ? `${label} search` : "Search"

  return (
    <div
      className={styleMerge(tagSearchVariants({ className }))}
      data-cy="TagSearch"
    >
      <div className="flex flex-col mb-6">
        <label htmlFor="tag-search" className="block-label">
          {searchLabel}
        </label>
        <Input
          shading
          autoComplete="off"
          id="tag-search"
          value={inputValue}
          onChange={handleInputChange}
        />
        {showDropdown && (
          <ul className="bg-white rounded-b-md w-full absolute z-10">
            {isLoading && (
              <li className="p-2 text-center">
                <span className="animate-pulse">Searching...</span>
              </li>
            )}
            {error && (
              <li className="p-2 text-red-500 text-center">
                <span>Search error: {error}</span>
              </li>
            )}
            {!isLoading &&
              !error &&
              results.map((item: Tag) => (
                <li key={item.id} className={dropdownItemClasses}>
                  <Button
                    className="block w-full h-full"
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
                <li className="p-2 text-center text-gray-500">
                  <span>No tags found</span>
                </li>
              )}
            {allowCreate && (
              <li className={dropdownItemClasses}>
                <CreateTagButton
                  action={handleItemClick}
                  setOpenDropdown={() => clearResults()}
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
      />
    </div>
  )
}

export default TagSearch
