import { cx, type VariantProps } from "class-variance-authority"
import { type HTMLProps, type ReactElement, type ReactNode, useRef, useState } from "react"

import { styleMerge } from "~/utils/styleUtils"

import TabPanel from "./TabPanel/TabPanel"
import { tabsVariants } from "./tabs-variants"

interface TabsProps
  extends Omit<HTMLProps<HTMLDivElement>, "size">,
    VariantProps<typeof tabsVariants> {
  children: ReactElement[]
  auxComponent?: ReactElement
  type: "default" | "secondary"
}

const TabContainer  = ({
  className,
  children,
  background,
  size = "md",
  auxComponent,
  type,
}: TabsProps) => {
  const [activeTab, setActiveTab] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleClick = (index: number) => {
    const tab = tabRefs.current[index]
    if (tab) {
      tab.focus()
    }
    setActiveTab(index)
  }

  const setIndex = (idx: number) => {
    const tab = tabRefs.current[idx]
    if (tab) {
      tab.focus()
    }
  }

  const onKeyDown = (evt: { key: string | number; preventDefault: () => void }) => {
    const count = children.length
    const nextTab = () => setIndex((activeTab + 1) % count)
    const prevTab = () => setIndex((activeTab - 1 + count) % count)
    const firstTab = () => setIndex(0)
    const lastTab = () => setIndex(count - 1)

    const keyMap = {
      ArrowLeft: prevTab,
      ArrowRight: nextTab,
      End: lastTab,
      Home: firstTab,
    }

    const action = keyMap[evt.key as keyof typeof keyMap]
    if (action) {
      evt.preventDefault()
      action()
    }
  }
  return (
    <>
      <div data-cy="Tabs" className="flex items-center justify-between w-full">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className={styleMerge(tabsVariants({ background, className, size, type }))}
        >
          {children &&
            children.map((child, idx) => {
              const tabClasses = cx({
                "bg-atom-gray-4 text-atom-gray-13":
                  activeTab !== idx && type === "secondary",
                "cursor-pointer": true,
                "p-3": size === "sm",
                "px-5 py-2.5": size === "md",
                "rounded-t-lg border-t border-l border-r capitalize":
                  type === "secondary",
                "text-atom-gray-16 bg-white border-atom-gray-4":
                  activeTab === idx && type === "secondary",
                "text-blue-active border-b-2 border-blue-active":
                  activeTab === idx && type === "default",
              })
              return (
                <button
                  key={`tab-${idx}`}
                  id={`tab-${idx}`}
                  onKeyDown={onKeyDown}
                  onClick={() => handleClick(idx)}
                  role="tab"
                  ref={ele => {
                    tabRefs.current[idx] = ele
                  }}
                  aria-selected={activeTab === idx}
                  aria-controls={`panel-${idx}`}
                  className={tabClasses}
                  tabIndex={activeTab === idx ? 0 : -1}
                  onFocus={() => setActiveTab(idx)}
                >
                  {(child as ReactElement<{ label: ReactNode }>).props.label}
                </button>
              )
            })}
        </div>
        {auxComponent && auxComponent}
      </div>
      {children &&
        children.map((child, idx) => (
          <TabPanel
            key={`panel-${idx}`}
            idx={idx}
            activeTab={activeTab}
            child={child as ReactElement<{ content: ReactNode }>  }
            type={type as "secondary"}
          />
        ))}
    </>
  )
}
export default TabContainer
