"use client"

import type { ReactNode } from "react"
import { LuLayoutGrid, LuList } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"

export type ResultsView = "grid" | "list"

export type ResultsViewToggleLabels = {
  view: string
  gridView: string
  listView: string
}

export type ResultsViewToggleProps = {
  view: ResultsView
  onViewChange: (view: ResultsView) => void
  labels: ResultsViewToggleLabels
  disabled?: boolean
  /** Per-option disable (e.g. list deferred while grid ships). */
  disabledViews?: ResultsView[]
  className?: string
}

const controlHeight = "h-11"

const viewButton = (
  value: ResultsView,
  current: ResultsView,
  label: string,
  icon: ReactNode,
  onViewChange: (view: ResultsView) => void,
  disabled: boolean
) => (
  <Button
    type="button"
    variant={null}
    size={null}
    disabled={disabled}
    aria-pressed={current === value}
    aria-label={label}
    title={label}
    onClick={() => onViewChange(value)}
    className={styleMerge(
      `${controlHeight} flex items-center justify-center rounded-none border-0 px-3 transition-colors md:min-w-[3.25rem] md:px-4`,
      current === value
        ? "bg-noir-gold text-noir-black"
        : "bg-noir-black/60 text-noir-gold hover:bg-noir-gold/20",
      disabled && current !== value ? "opacity-50" : ""
    )}
  >
    {icon}
  </Button>
)

/**
 * Shared grid/list results toggle (Archive, Houses, Exchange, Seeking).
 * Matches Exchange sizing: h-11 with horizontal padding so the control is not a narrow icon square.
 */
export const ResultsViewToggle = ({
  view,
  onViewChange,
  labels,
  disabled = false,
  disabledViews = [],
  className,
}: ResultsViewToggleProps) => (
  <div
    role="group"
    aria-label={labels.view}
    className={styleMerge(
      "flex shrink-0 overflow-hidden rounded-sm border border-noir-gold",
      className
    )}
  >
    {viewButton(
      "grid",
      view,
      labels.gridView,
      <LuLayoutGrid className="h-5 w-5 md:h-6 md:w-6" aria-hidden />,
      onViewChange,
      disabled || disabledViews.includes("grid")
    )}
    {viewButton(
      "list",
      view,
      labels.listView,
      <LuList className="h-5 w-5 md:h-6 md:w-6" aria-hidden />,
      onViewChange,
      disabled || disabledViews.includes("list")
    )}
  </div>
)

export default ResultsViewToggle
