import fs from "fs"
import path from "path"

export const docsMentionNoSales = (): boolean => {
  const quality = fs.readFileSync(
    path.join(process.cwd(), "docs/quality-gates.md"),
    "utf8"
  )
  const baselines = fs.readFileSync(
    path.join(process.cwd(), "docs/performance-baselines.md"),
    "utf8"
  )
  const combined = `${quality}\n${baselines}`.toLowerCase()
  return (
    combined.includes("never add product sales") ||
    combined.includes("digital")
  )
}
