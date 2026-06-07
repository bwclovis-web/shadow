"use client"

import DecantSplitsPanel from "@/components/Containers/MyScents/DecantSplit/DecantSplitsPanel"
import MyListingsPanel from "@/components/Containers/MyScents/MyListingsPanel"
import type { UserPerfumeForClient } from "@/types/my-scents-client"

type ListingsTabProps = {
  activeListings: UserPerfumeForClient[]
  pausedListings: UserPerfumeForClient[]
  basePath: string
  onListingChange: (updated: UserPerfumeForClient) => void
}

const ListingsTab = ({
  activeListings,
  pausedListings,
  basePath,
  onListingChange,
}: ListingsTabProps) => (
  <>
    <DecantSplitsPanel />
    <MyListingsPanel
      activeListings={activeListings}
      pausedListings={pausedListings}
      basePath={basePath}
      onListingChange={onListingChange}
    />
  </>
)

export default ListingsTab
