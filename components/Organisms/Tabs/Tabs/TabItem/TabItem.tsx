import { type ReactNode } from "react"

interface TapItemProps {
  label: string
  content: ReactNode
}
const TabItem = ({ label, content }: TapItemProps) => (
  <div>
    <span>{label}</span>
    <div>{content}</div>
  </div>
)

export default TabItem
