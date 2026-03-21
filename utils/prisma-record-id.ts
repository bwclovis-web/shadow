/**
 * Validates string primary keys used in this project: Prisma `@default(cuid())` output
 * and RFC 4122 UUID strings (e.g. some manually assigned ids).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Prisma legacy cuid(): 25 chars, leading `c`. */
const PRISMA_CUID1_REGEX = /^c[a-z0-9]{24}$/i

/**
 * cuid2-style ids (lowercase letter + alnum). Overlaps with cuid1; kept explicit for clarity.
 */
const PRISMA_CUID2_LIKE_REGEX = /^[a-z][a-z0-9]{23,39}$/i

export function isValidPrismaRecordId(raw: string): boolean {
  const id = raw.trim()
  if (id.length < 24 || id.length > 128) return false
  if (UUID_REGEX.test(id)) return true
  if (PRISMA_CUID1_REGEX.test(id)) return true
  if (PRISMA_CUID2_LIKE_REGEX.test(id)) return true
  return false
}
