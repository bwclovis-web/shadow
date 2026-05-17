const readEnv = (studioKey: string, nextKey: string, fallback = ""): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const fromMeta = (import.meta.env as Record<string, string | undefined>)[studioKey]
    if (fromMeta) return fromMeta
  }
  if (typeof process !== "undefined" && process.env) {
    const fromProcess = process.env[studioKey] ?? process.env[nextKey]
    if (fromProcess) return fromProcess
  }
  return fallback
}

export const apiVersion = readEnv(
  "SANITY_STUDIO_API_VERSION",
  "NEXT_PUBLIC_SANITY_API_VERSION",
  "2025-05-17"
)

export const dataset = readEnv(
  "SANITY_STUDIO_DATASET",
  "NEXT_PUBLIC_SANITY_DATASET",
  "production"
)

export const projectId = readEnv("SANITY_STUDIO_PROJECT_ID", "NEXT_PUBLIC_SANITY_PROJECT_ID")

export const isSanityConfigured = Boolean(projectId)

export const sanityReadToken = process.env.SANITY_API_READ_TOKEN ?? ""
