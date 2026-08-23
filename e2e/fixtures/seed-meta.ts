import fs from "node:fs"
import path from "node:path"

export type E2eSeedMeta = {
  freeUserId: string
  premiumUserId: string
  adminUserId: string
  freeProfileSlug: string
  premiumProfileSlug: string
  perfumeIds: Array<{ id: string; slug: string; name: string }>
}

export const readSeedMeta = (): E2eSeedMeta => {
  const file = path.join(__dirname, "..", ".auth", "seed-meta.json")
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run: npm run test:e2e:seed`
    )
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as E2eSeedMeta
}
