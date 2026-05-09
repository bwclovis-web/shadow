import type { ReactNode } from "react"

/** True when `children` should render visible heading text (non-empty string or non-text node). */
export const hasMeaningfulButtonChildren = (children: ReactNode): boolean => {
  if (children == null || children === false) {
    return false
  }
  if (typeof children === "string") {
    return children.trim().length > 0
  }
  return true
}
