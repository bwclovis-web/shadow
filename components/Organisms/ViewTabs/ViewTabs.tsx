"use client"

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
} from "react"

import { styleMerge } from "@/utils/styleUtils"

export type ViewTabItem<T extends string> = {
  id: T
  label: string
  badgeCount?: number
  panel: ReactNode
}

type ViewTabsProps<T extends string> = {
  tabs: readonly ViewTabItem<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
  ariaLabel: string
}

const ViewTabs = <T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
}: ViewTabsProps<T>) => {
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  )

  const focusTab = useCallback(
    (index: number) => {
      const tab = tabRefs.current[index]
      if (tab) tab.focus()
      onTabChange(tabs[index].id)
    },
    [onTabChange, tabs]
  )

  const handleKeyDown = (evt: KeyboardEvent<HTMLButtonElement>) => {
    const count = tabs.length
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

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className="flex w-full gap-1"
      >
        {tabs.map((tab, idx) => {
          const isActive = activeIndex === idx
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-controls={`${baseId}-panel-${tab.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={handleKeyDown}
              onClick={() => onTabChange(tab.id)}
              className={styleMerge(
                "relative -mb-px flex-1 cursor-pointer rounded-t-lg border px-4 py-3 text-sm font-semibold transition-colors sm:text-base",
                isActive
                  ? "z-10 border border-noir-gold border-b-transparent bg-noir-black/30 text-noir-gold"
                  : "border border-transparent border-b-noir-gold bg-transparent text-noir-gold-500 hover:border-noir-gold/30 hover:bg-noir-gold/5 hover:text-noir-gold-100"
              )}
            >
              {tab.label}
              {tab.badgeCount != null && tab.badgeCount > 0 && (
                <span className="ml-2 text-xs font-normal text-noir-gold-300">
                  ({tab.badgeCount})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tabs.map((tab, idx) => (
        <section
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={activeIndex !== idx}
          tabIndex={0}
          className="rounded-b-lg border border-t-0 border-noir-gold bg-noir-black/30 p-4 pt-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-noir-gold/50"
        >
          {tab.panel}
        </section>
      ))}
    </div>
  )
}

export default ViewTabs
