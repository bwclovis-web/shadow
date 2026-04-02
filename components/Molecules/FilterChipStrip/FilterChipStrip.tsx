"use client"

import { Button } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"
import type { FC } from "react"

export type FilterChipStripItem = {
  id: string
  label: string
  removeAriaLabel: string
  onRemove: () => void
}

export type FilterChipStripProps = {
  chips: FilterChipStripItem[]
  regionAriaLabel: string
  onClearAll?: () => void
  clearAllLabel?: string
  variant?: "dark" | "light"
  className?: string
}

const chipDark =
  "flex items-center gap-1 rounded border border-stone-500 bg-stone-900/60 px-2 py-1 text-sm text-noir-gold-100 whitespace-nowrap"
const chipLight =
  "flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-sm text-noir-black whitespace-nowrap"
const removeDark =
  "ml-1 p-1 text-red-400 hover:text-red-300 hover:bg-stone-700 rounded-full"
const removeLight =
  "ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"

export const FilterChipStrip: FC<FilterChipStripProps> = ({
  chips,
  regionAriaLabel,
  onClearAll,
  clearAllLabel,
  variant = "dark",
  className,
}) => {
  if (chips.length === 0 && !onClearAll) {
    return null
  }

  const isDark = variant === "dark"
  const chipClass = isDark ? chipDark : chipLight
  const removeClass = isDark ? removeDark : removeLight

  return (
    <div
      className={styleMerge("flex flex-wrap items-center gap-2", className)}
      role="region"
      aria-label={regionAriaLabel}
    >
      <ul className="flex min-w-0 flex-1 flex-wrap gap-2" role="list">
        {chips.map(chip => (
          <li key={chip.id} className={chipClass} role="listitem">
            <span>{chip.label}</span>
            <Button
              type="button"
              className={removeClass}
              onClick={chip.onRemove}
              aria-label={chip.removeAriaLabel}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      {onClearAll && clearAllLabel ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={onClearAll}
        >
          {clearAllLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default FilterChipStrip
