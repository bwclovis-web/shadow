"use client"

import { Button } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"
import type { LiHTMLAttributes, ReactNode } from "react"
import { IoMdCloseCircle } from "react-icons/io"

export type RemovableChipVisual = "tag" | "filter"
export type RemovableChipTone = "light" | "dark"

type RemovableChipBase = {
  label: ReactNode
  visual: RemovableChipVisual
  tone: RemovableChipTone
  className?: string
} & Omit<LiHTMLAttributes<HTMLLIElement>, "children">

export type RemovableChipProps = RemovableChipBase &
  (
    | {
        onRemove: () => void
        removeAriaLabel: string
        removeTitle?: string
      }
    | {
        onRemove?: undefined
        removeAriaLabel?: undefined
        removeTitle?: undefined
      }
  )

const chipClassByVisualTone: Record<
  RemovableChipVisual,
  Record<RemovableChipTone, string>
> = {
  tag: {
    light:
      "inline-flex max-w-full items-center justify-around gap-1.5 rounded-full border border-noir-gold/20 bg-noir-gold/[0.06] px-1 py-1 text-xs font-medium text-noir-dark shadow-sm",
    dark:
      "inline-flex max-w-full items-center justify-around gap-1.5 rounded-full border border-noir-gold/30 bg-stone-900/70 px-2 py-1 text-xs font-medium text-noir-gold-100",
  },
  filter: {
    light:
      "flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-sm text-noir-black whitespace-nowrap",
    dark:
      "flex items-center gap-1 rounded border border-stone-500 bg-stone-900/60 px-2 py-1 text-sm text-noir-gold-100 whitespace-nowrap",
  },
}

const removeClassByVisualTone: Record<
  RemovableChipVisual,
  Record<RemovableChipTone, string>
> = {
  tag: {
    light:
      "shrink-0 rounded-full p-0.5 text-noir-dark transition-colors hover:bg-noir-gold/10 hover:text-noir-gold-100 flex items-center justify-center",
    dark:
      "shrink-0 rounded-full p-0.5 text-noir-dark transition-colors hover:bg-noir-dark hover:text-noir-gold-100 flex items-center justify-center",
  },
  filter: {
    light:
      "ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full",
    dark:
      "ml-1 p-1 text-red-400 hover:text-red-300 hover:bg-stone-700 rounded-full",
  },
}

export const RemovableChip = ({
  label,
  visual,
  tone,
  onRemove,
  removeAriaLabel,
  removeTitle,
  className,
  ...liProps
}: RemovableChipProps) => {
  const chipClass = styleMerge(chipClassByVisualTone[visual][tone], className)
  const removeClass = removeClassByVisualTone[visual][tone]
  const labelClassName =
    visual === "tag" ? "min-w-0 truncate" : undefined

  return (
    <li className={chipClass} {...liProps}>
      <span className={labelClassName}>{label}</span>
      {onRemove != null && removeAriaLabel != null ? (
        <Button
          type="button"
          className={removeClass}
          onClick={onRemove}
          title={removeTitle}
          aria-label={removeAriaLabel}
        >
          <IoMdCloseCircle className="h-5 w-5" aria-hidden />
        </Button>
      ) : null}
    </li>
  )
}
