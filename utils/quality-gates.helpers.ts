import fs from "fs"
import path from "path"

export const docsMentionNoSales = (): boolean => {
  const quality = fs.readFileSync(
    path.join(process.cwd(), "docs/quality.md"),
    "utf8"
  )
  const combined = quality.toLowerCase()
  return (
    combined.includes("never add product sales") ||
    combined.includes("digital")
  )
}
