/**
 * Pure helpers for user profile URL slugs (shared client + server).
 * Must match DB-backed slug assignment in `profile-slug.server.ts`.
 */
export function slugifyUsernameForProfile(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
