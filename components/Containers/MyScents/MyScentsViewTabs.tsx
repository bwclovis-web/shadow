"use client"

import { type ReactNode } from "react"

import ViewTabs from "@/components/Organisms/ViewTabs"
import type { MyScentsView } from "@/types/my-scents-client"

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
}: MyScentsViewTabsProps) => (
  <ViewTabs<MyScentsView>
    activeTab={activeView}
    onTabChange={onViewChange}
    ariaLabel={ariaLabel}
    tabs={[
      {
        id: "inventory",
        label: inventoryLabel,
        panel: inventoryPanel,
      },
      {
        id: "listings",
        label: listingsLabel,
        badgeCount: listingsCount,
        panel: listingsPanel,
      },
    ]}
  />
)

export default MyScentsViewTabs
