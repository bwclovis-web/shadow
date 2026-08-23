/**
 * Sanity env for both Next.js (embedded /studio) and standalone `sanity dev`.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when accessed with a static
 * property name — dynamic `process.env[key]` is empty in the browser bundle and
 * breaks Studio with "Configuration must contain projectId".
 */

const fromImportMeta = (key: string): string => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const value = (import.meta.env as Record<string, string | undefined>)[key]
      if (value) return value
    }
  } catch {
    /* import.meta.env unavailable in some CJS contexts */
  }
  return ""
}

const trim = (value: string | undefined): string => (value ?? "").trim()

export const apiVersion =
  trim(fromImportMeta("SANITY_STUDIO_API_VERSION")) ||
  trim(process.env.SANITY_STUDIO_API_VERSION) ||
  trim(process.env.NEXT_PUBLIC_SANITY_API_VERSION) ||
  "2025-05-17"

export const dataset =
  trim(fromImportMeta("SANITY_STUDIO_DATASET")) ||
  trim(process.env.SANITY_STUDIO_DATASET) ||
  trim(process.env.NEXT_PUBLIC_SANITY_DATASET) ||
  "production"

export const projectId =
  trim(fromImportMeta("SANITY_STUDIO_PROJECT_ID")) ||
  trim(process.env.SANITY_STUDIO_PROJECT_ID) ||
  trim(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID)

export const isSanityConfigured = Boolean(projectId)

export const sanityReadToken = trim(process.env.SANITY_API_READ_TOKEN)
