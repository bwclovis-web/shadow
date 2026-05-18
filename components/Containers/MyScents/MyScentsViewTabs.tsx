"use client"

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
} from "react"

import type { MyScentsView } from "@/types/my-scents-client"
import { styleMerge } from "@/utils/styleUtils"

const VIEWS: MyScentsView[] = ["inventory", "listings"]

type MyScentsViewTabsProps = {
  activeView: MyScentsView
  onViewChange: (view: MyScentsView) => void
  inventoryLabel: string
  listingsLabel: string
  ariaLabel: string
  listingsCount?: number
  inventoryPanel: ReactNode
  listingsPanel: ReactNode
}

const MyScentsViewTabs = ({
  activeView,
  onViewChange,
  inventoryLabel,
  listingsLabel,
  ariaLabel,
  listingsCount = 0,
  inventoryPanel,
  listingsPanel,
}: MyScentsViewTabsProps) => {
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = activeView === "listings" ? 1 : 0

  const focusTab = useCallback((index: number) => {
    const tab = tabRefs.current[index]
    if (tab) tab.focus()
    onViewChange(VIEWS[index])
  }, [onViewChange])

  const handleKeyDown = (evt: KeyboardEvent<HTMLButtonElement>) => {
    const count = VIEWS.length
    const keyMap: Record<string, () => void> = {
      ArrowLeft: () => focusTab((activeIndex - 1 + count) % count),
      ArrowRight: () => focusTab((activeIndex + 1) % count),
      Home: () => focusTab(0),
      End: () => focusTab(count - 1),
    }
    const action = keyMap[evt.key]
    if (action) {
      evt.preventDefault()
      action()
    }
  }

  const labels: Record<MyScentsView, string> = {
    inventory: inventoryLabel,
    listings: listingsLabel,
  }

  const panels: Record<MyScentsView, ReactNode> = {
    inventory: inventoryPanel,
    listings: listingsPanel,
  }

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="flex w-full gap-1 border-b border-noir-gold/50"
      >
        {VIEWS.map((view, idx) => {
          const isActive = activeIndex === idx
          return (
            <button
              key={view}
              ref={(el) => {
                tabRefs.current[idx] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${view}`}
              aria-controls={`${baseId}-panel-${view}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={handleKeyDown}
              onClick={() => onViewChange(view)}
              className={styleMerge(
                "relative -mb-px flex-1 cursor-pointer rounded-t-lg border px-4 py-3 text-sm font-semibold transition-colors sm:text-base",
                isActive
                  ? "z-10 border border-noir-gold border-b-transparent bg-noir-black/30 text-noir-gold"
                  : "border border-transparent border-b-noir-gold/50 bg-transparent text-noir-gold-500 hover:border-noir-gold/30 hover:bg-noir-gold/5 hover:text-noir-gold-100"
              )}
            >
              {labels[view]}
              {view === "listings" && listingsCount > 0 && (
                <span className="ml-2 text-xs font-normal text-noir-gold-300">
                  ({listingsCount})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {VIEWS.map((view, idx) => (
        <section
          key={view}
          id={`${baseId}-panel-${view}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${view}`}
          hidden={activeIndex !== idx}
          tabIndex={0}
          className="rounded-b-lg border border-t-0 border-noir-gold/50 bg-noir-black/30 p-4 pt-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-noir-gold/50"
        >
          {panels[view]}
        </section>
      ))}
    </div>
  )
}

export default MyScentsViewTabs
