"use client"

import { Button } from "@/components/Atoms/Button/Button"
import { RemovableChip } from "@/components/Molecules/RemovableChip"
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

  const tone = variant === "dark" ? "dark" : "light"

  return (
    <div
      className={styleMerge("flex flex-wrap items-center gap-2", className)}
      role="region"
      aria-label={regionAriaLabel}
    >
      <ul className="flex min-w-0 flex-1 flex-wrap gap-2" role="list">
        {chips.map(chip => (
          <RemovableChip
            key={chip.id}
            role="listitem"
            visual="tag"
            tone={tone}
            label={chip.label}
            onRemove={chip.onRemove}
            removeAriaLabel={chip.removeAriaLabel}
          />
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
