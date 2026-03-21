import type { Prisma, PrismaClient } from "@prisma/client"

import { slugifyUsernameForProfile } from "@/utils/profile-slug"

type DbClient = PrismaClient | Prisma.TransactionClient

/**
 * Reserve a unique `User.profileSlug` for the given username.
 * @param excludeUserId - when updating an existing user, exclude their row from the uniqueness check
 */
export async function allocateUniqueProfileSlug(
  client: DbClient,
  username: string,
  excludeUserId: string | null
): Promise<string> {
  let base = slugifyUsernameForProfile(username)
  if (!base) {
    base = excludeUserId ?? "user"
  }

  let candidate = base
  let n = 2
  for (;;) {
    const existing = await client.user.findFirst({
      where: {
        profileSlug: candidate,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    })
    if (!existing) {
      return candidate
    }
    candidate = `${base}-${n}`
    n += 1
  }
}
