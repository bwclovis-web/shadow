import { type ReactElement, type ReactNode } from "react"

import { styleMerge } from "~/utils/styleUtils"

import { tabsPanelVariants } from "../tabs-variants"
interface TabPanelProps {
  idx: number
  child: ReactElement<{ content: ReactNode }>
  activeTab: number
  type: "secondary"
}

const TabPanel = ({ idx, child, activeTab, type }: TabPanelProps) => (
  <section
    key={`panel-${idx}`}
    id={`panel-${idx}`}
    role="tabpanel"
    tabIndex={0}
    aria-labelledby={`tab-${idx}`}
    hidden={activeTab !== idx}
    className={styleMerge(tabsPanelVariants({ type }))}
  >
    {child.props.content as ReactNode}
  </section>
)

export default TabPanel
