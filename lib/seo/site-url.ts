/** Public site origin for canonical URLs, OG tags, and JSON-LD. */
export const getSiteUrl = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export const absoluteUrl = (path: string): string => {
  const base = getSiteUrl()
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}
