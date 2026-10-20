import type { ResultsView } from "@/components/Molecules/ResultsViewToggle"

/** Inventory vs listings uses `view`; grid/list uses `layout` to avoid collision. */
export const MY_SCENTS_QUERY = {
  tab: "view",
  layout: "layout",
  page: "pg",
} as const

export const MY_SCENTS_LAYOUTS = ["grid", "list"] as const
export type MyScentsLayout = (typeof MY_SCENTS_LAYOUTS)[number]
export const DEFAULT_MY_SCENTS_LAYOUT: MyScentsLayout = "grid"

export const parseMyScentsLayout = (raw: string | null | undefined): ResultsView =>
  raw === "list" ? "list" : "grid"
