"use client"

import { useTransitionRouter } from "next-view-transitions"
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import Input from "@/components/Atoms/Input/Input"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { highlightSearchTerm } from "@/utils/highlightSearchTerm"
import { styleMerge } from "@/utils/styleUtils"

import {
  type TypeaheadSurface,
  typeaheadItemRowClasses,
  typeaheadPanelClasses,
} from "./search-typeahead-surfaces"

export type TypeaheadItem = { id: string; name: string }

export type SearchTypeaheadProps<T extends TypeaheadItem = TypeaheadItem> = {
  inputId: string
  listboxId?: string
  label: string
  labelClassName?: string
  placeholder?: string
  searchFn: (query: string) => Promise<T[]>
  minLength?: number
  delay?: number
  defaultInputValue?: string
  inputValue?: string
  onInputChange?: (value: string) => void
  onSelect?: (item: T) => void
  getOptionHref?: (item: T) => string
  optionMode?: "link" | "action"
  placement: "inline" | "portal"
  portalContainer?: Element | DocumentFragment | null
  surface: TypeaheadSurface
  inputClassName?: string
  useShadedInput?: boolean
  inputWrapperClassName?: string
  messages: {
    loading: string
    empty: string
    formatError: (error: string) => string
  }
  /** Extra list rows (e.g. create tag). Use a function to receive `clearList` for closing the panel. */
  footerSlot?: ReactNode | ((ctx: { clearList: () => void }) => ReactNode)
  /** Whether selecting an option also clears the input text. */
  clearInputOnSelect?: boolean
  disabled?: boolean
  name?: string
  autoComplete?: string
  "data-testid"?: string
}

function useTypeaheadPosition(
  placement: "inline" | "portal",
  open: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>
) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  useLayoutEffect(() => {
    if (placement !== "portal" || !open || !inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setCoords({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    })
  }, [placement, open, inputRef])

  useEffect(() => {
    if (placement !== "portal" || !open) return
    const onResize = () => {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      })
    }
    window.addEventListener("scroll", onResize, true)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onResize, true)
      window.removeEventListener("resize", onResize)
    }
  }, [placement, open, inputRef])

  return coords
}

export function SearchTypeahead<T extends TypeaheadItem = TypeaheadItem>({
  inputId,
  listboxId: listboxIdProp,
  label,
  labelClassName,
  placeholder,
  searchFn,
  minLength = 2,
  delay = 300,
  defaultInputValue = "",
  inputValue: controlledValue,
  onInputChange,
  onSelect,
  getOptionHref,
  optionMode,
  placement,
  portalContainer,
  surface,
  inputClassName,
  useShadedInput = false,
  inputWrapperClassName,
  messages,
  footerSlot,
  clearInputOnSelect = false,
  disabled = false,
  name,
  autoComplete = "off",
  "data-testid": dataTestId,
}: SearchTypeaheadProps<T>) {
  const listboxId = listboxIdProp ?? `${inputId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const router = useTransitionRouter()

  const resolvedOptionMode =
    optionMode ?? (getOptionHref && !onSelect ? "link" : "action")

  const debounceOpts =
    controlledValue !== undefined
      ? {
          delay,
          minLength,
          value: controlledValue,
          onValueChange: onInputChange,
        }
      : { delay, minLength, initialValue: defaultInputValue }

  const {
    searchValue,
    setSearchValue,
    results,
    isLoading,
    error,
    clearResults,
  } = useDebouncedSearch<T>(searchFn, debounceOpts)

  const trimmed = searchValue.trim()
  const [dismissed, setDismissed] = useState(false)
  const listOpen = trimmed.length >= minLength && !dismissed

  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    setActiveIndex(-1)
  }, [results, isLoading, error])

  const selectableCount = results.length
  const coords = useTypeaheadPosition(placement, listOpen, inputRef)

  const clearQuery = useCallback((clearInput = true, closeList = true) => {
    clearResults()
    if (clearInput) {
      setSearchValue("")
    }
    setActiveIndex(-1)
    if (closeList) {
      setDismissed(true)
    }
  }, [clearResults, setSearchValue])

  useEffect(() => {
    if (!listOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return
      clearResults()
      setActiveIndex(-1)
      setDismissed(true)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [listOpen, clearResults])

  const handleSelect = useCallback(
    (item: T) => {
      onSelect?.(item)
      clearQuery(clearInputOnSelect)
    },
    [onSelect, clearQuery, clearInputOnSelect]
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen) {
      if (e.key === "Escape") {
        clearResults()
        setActiveIndex(-1)
        setDismissed(true)
      }
      return
    }

    if (selectableCount === 0) {
      if (e.key === "Escape") {
        e.preventDefault()
        clearResults()
        setActiveIndex(-1)
        setDismissed(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault()
        setActiveIndex(i => (i < selectableCount - 1 ? i + 1 : 0))
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        setActiveIndex(i => (i > 0 ? i - 1 : selectableCount - 1))
        break
      }
      case "Enter": {
        if (activeIndex >= 0 && activeIndex < selectableCount) {
          e.preventDefault()
          const item = results[activeIndex]!
          if (resolvedOptionMode === "link" && getOptionHref) {
            router.push(getOptionHref(item))
            clearQuery()
          } else {
            handleSelect(item)
          }
        }
        break
      }
      case "Escape": {
        e.preventDefault()
        clearResults()
        setActiveIndex(-1)
        setDismissed(true)
        break
      }
      case "Home": {
        if (e.ctrlKey) return
        e.preventDefault()
        setActiveIndex(0)
        break
      }
      case "End": {
        if (e.ctrlKey) return
        e.preventDefault()
        setActiveIndex(selectableCount - 1)
        break
      }
      default:
        break
    }
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDismissed(false)
    setSearchValue(e.target.value)
  }

  const panelBase = typeaheadPanelClasses[surface]
  const itemRow = typeaheadItemRowClasses[surface]
  const mutedText = surface === "dark" ? "text-stone-400" : "text-gray-500"
  const pulseText = surface === "dark" ? "text-noir-gold-300" : undefined

  const listbox = (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={label}
      tabIndex={-1}
      className={styleMerge(
        panelBase,
        placement === "portal" ? "fixed z-[99999]" : "absolute left-0 right-0 z-50 mt-0"
      )}
      style={
        placement === "portal"
          ? {
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }
          : undefined
      }
    >
      {isLoading && (
        <li className="p-2 text-center" role="presentation">
          <span className={styleMerge("animate-pulse", pulseText)}>
            {messages.loading}
          </span>
        </li>
      )}
      {error && (
        <li className="p-2 text-center text-red-400" role="presentation">
          {messages.formatError(error)}
        </li>
      )}
      {!isLoading &&
        !error &&
        results.map((item, index) => {
          const optId = `${listboxId}-opt-${item.id}`
          const isActive = index === activeIndex
          const highlighted = highlightSearchTerm(item.name, searchValue)

          const rowClass = styleMerge(
            itemRow,
            isActive && "bg-noir-gold/20 ring-1 ring-inset ring-noir-gold/40"
          )

          if (resolvedOptionMode === "link" && getOptionHref) {
            return (
              <li
                key={item.id}
                id={optId}
                role="option"
                aria-selected={isActive}
                className={rowClass}
              >
                <PrefetchLink
                  href={getOptionHref(item)}
                  prefetch={false}
                  className="block min-w-full capitalize"
                  onClick={() => clearQuery()}
                  onMouseDown={e => e.preventDefault()}
                >
                  {highlighted}
                </PrefetchLink>
              </li>
            )
          }

          return (
            <li
              key={item.id}
              id={optId}
              role="option"
              aria-selected={isActive}
              className={rowClass}
            >
              <button
                type="button"
                className="block min-w-full text-left capitalize p-2 hover:bg-noir-dark hover:text-noir-light cursor-pointer"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                {highlighted}
              </button>
            </li>
          )
        })}
      {!isLoading &&
        !error &&
        results.length === 0 && (
          <li
            className={styleMerge("p-2 text-center", mutedText)}
            role="presentation"
          >
            {messages.empty}
          </li>
        )}
      {typeof footerSlot === "function"
        ? footerSlot({ clearList: clearQuery })
        : footerSlot}
    </ul>
  )

  const activeDescendant =
    activeIndex >= 0 && activeIndex < selectableCount
      ? `${listboxId}-opt-${results[activeIndex]!.id}`
      : undefined

  const comboboxA11y = {
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    "aria-expanded": listOpen,
    "aria-controls": listboxId,
    "aria-activedescendant": activeDescendant,
    "aria-haspopup": "listbox" as const,
  }

  const inputEl = useShadedInput ? (
    <Input
      shading
      autoComplete={autoComplete}
      inputId={inputId}
      name={name}
      value={searchValue}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      inputRef={inputRef}
      className={inputWrapperClassName}
      inputType="text"
      {...comboboxA11y}
    />
  ) : (
    <input
      ref={inputRef}
      type="text"
      id={inputId}
      name={name}
      autoComplete={autoComplete}
      disabled={disabled}
      {...comboboxA11y}
      value={searchValue}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={inputClassName}
      data-testid={dataTestId}
    />
  )

  return (
    <div
      ref={rootRef}
      className={styleMerge(
        "relative w-full",
        placement === "inline" && "isolate"
      )}
    >
      <label
        htmlFor={inputId}
        className={styleMerge("block-label", labelClassName)}
      >
        {label}
      </label>
      {inputEl}
      {listOpen &&
        (placement === "portal"
          ? createPortal(listbox, portalContainer ?? document.body)
          : listbox)}
    </div>
  )
}

export default SearchTypeahead
