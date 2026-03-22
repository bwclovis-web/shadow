"use client"

import { useTranslations } from "next-intl"
import { LuGitCompareArrows } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button/Button"
import {
  COMPARE_MAX_ITEMS,
  type CompareItem,
  useCompareStore,
} from "@/hooks/compareStore"
import { styleMerge } from "@/utils/styleUtils"

export interface PerfumeCompareToggleProps {
  item: CompareItem
}

/**
 * Card compare control; must stay a sibling of `PrefetchLink`, not nested inside it.
 * @see docs/compare-client.md
 */
export function PerfumeCompareToggle({ item }: PerfumeCompareToggleProps) {
  const t = useTranslations("compare")
  const items = useCompareStore((s) => s.items)
  const toggle = useCompareStore((s) => s.toggle)

  const selected = items.some((i) => i.id === item.id)
  const atMax = items.length >= COMPARE_MAX_ITEMS
  const disabled = !selected && atMax

  const label = disabled
    ? t("maxReached", { max: COMPARE_MAX_ITEMS })
    : selected
      ? t("toggleRemove")
      : t("toggleAdd")

  return (
    <div className="pointer-events-auto absolute top-2 right-2 z-20">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-pressed={selected}
        disabled={disabled}
        title={label}
        aria-label={label}
        className={styleMerge(
          "!p-2 border-noir-gold",
          selected && "bg-noir-gold/20 text-noir-gold-100 border-noir-gold-500",
          disabled && "opacity-60"
        )}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (disabled) return
          toggle(item)
        }}
      >
        <LuGitCompareArrows className="h-5 w-5" aria-hidden />
      </Button>
    </div>
  )
}
