import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { styleMerge } from "~/utils/styleUtils"

interface HouseTypeaheadProps {
  label?: string
  name: string
  defaultId?: string
  defaultName?: string
  className?: string
}

const HouseTypeahead = ({
  label,
  name,
  defaultId,
  defaultName,
  className,
}: HouseTypeaheadProps) => {
  const [results, setResults] = useState<any[]>([])
  const [searchValue, setSearchValue] = useState(defaultName || "")
  const [selectedId, setSelectedId] = useState(defaultId || "")
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  })
  const [showDropdown, setShowDropdown] = useState(false)
  const inputId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (defaultName) {
      setSearchValue(defaultName)
    }
    if (defaultId) {
      setSelectedId(defaultId)
    }
  }, [defaultName, defaultId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setResults([])
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    try {
      const res = await fetch(`/api/perfume-houses?name=${encodeURIComponent(query)}`)
      const data = await res.json()
      // Search results loaded
      setResults(data)

      if (data.length > 0) {
        const input = document.getElementById(inputId) as HTMLInputElement
        if (input) {
          const rect = input.getBoundingClientRect()
          setDropdownPosition({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
          })
          setShowDropdown(true)
        }
      } else {
        setShowDropdown(false)
      }
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
      setShowDropdown(false)
    }
  }

  const handleKeyUp = async (evt: KeyboardEvent<HTMLInputElement>) => {
    const query = (evt.target as HTMLInputElement).value
    await handleSearch(query)
  }

  const handleChange = async (evt: ChangeEvent<HTMLInputElement>) => {
    const query = evt.target.value
    const previousSearchValue = searchValue
    setSearchValue(query)
    // Clear selection if user manually types (value differs from selected)
    if (selectedId && query !== previousSearchValue) {
      setSelectedId("")
    }
    await handleSearch(query)
  }

  const handleSelect = (item: any) => {
    setSearchValue(item.name)
    setSelectedId(item.id)
    setShowDropdown(false)
    setResults([])
  }

  return (
    <div ref={wrapperRef} className={styleMerge("relative w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-noir-gold-100 mb-2"
        >
          {label}
        </label>
      )}
      <input
        type="text"
        id={inputId}
        autoComplete="off"
        onChange={handleChange}
        value={searchValue}
        placeholder="Search for a perfume house..."
        onKeyUp={handleKeyUp}
        className={styleMerge(
          "w-full px-4 py-2 bg-noir-dark/50 border-2 rounded-md text-noir-gold-100 placeholder-noir-gold-100/50 focus:outline-none transition-colors",
          selectedId
            ? "border-green-500/50"
            : "border-noir-gold/30 focus:border-noir-gold"
        )}
        
      />
      <input type="hidden" name={name} value={selectedId} />
      {selectedId && <p className="text-xs text-green-400 mt-1">✓ House selected</p>}

      {results.length > 0 &&
        showDropdown &&
        createPortal(
          <ul
            className="bg-noir-dark rounded-b-md border-l-8 border-b-8 absolute border-r-8 border-noir-gold/80 border-double z-[99999] max-h-52 overflow-y-auto shadow-2xl"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {results.map((item: any) => (
              <li
                key={item.id}
                className="p-2 text-noir-gold-100 hover:bg-noir-gold hover:text-noir-black font-semibold cursor-pointer last-of-type:rounded-b-md transition-colors"
              >
                <button
                  type="button"
                  className="block min-w-full text-left"
                  onMouseDown={event => {
                    event.preventDefault()
                    handleSelect(item)
                  }}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  )
}

export default HouseTypeahead
