import { statSync } from "node:fs"
import { join } from "node:path"

/**
 * Public static asset URL with a cache-busting query from the file mtime.
 * Use for `/images/...` banners so replaced files show up without clearing `.next/cache`.
 */
export const publicAssetUrl = (publicPath: string): string => {
  if (!publicPath.startsWith("/")) {
    return publicPath
  }

  const relativePath = publicPath.slice(1)
  try {
    const mtime = statSync(join(process.cwd(), "public", relativePath)).mtimeMs
    return `${publicPath}?v=${mtime}`
  } catch {
    return publicPath
  }
}
