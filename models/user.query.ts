/**
 * User query functions - separated to avoid circular dependencies
 * This file should NOT import from session.server.ts or any files that import from session.server.ts
 */

import type { SubscriptionStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  })
  return user
}

export const getUserByName = async (username: string) => {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  })
  return user
}

export const getUserByEmail = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  })
  return user
}

/**
 * Fetch only tokenVersion for a user (for JWT verification / session invalidation).
 */
export const getUserTokenVersion = async (userId: string): Promise<number | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  })
  return user?.tokenVersion ?? null
}

export const getAllUsers = async () => {
  const users = await prisma.user.findMany()
  return users
}

/**
 * Find users by subscription status. For admin filtering and gating.
 */
export const getUsersBySubscriptionStatus = async (status: SubscriptionStatus) => {
  return prisma.user.findMany({
    where: { subscriptionStatus: status },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Find users by early adopter flag. For admin and reporting (e.g. first 100 free users).
 */
export const getUsersByEarlyAdopter = async (isEarlyAdopter: boolean) => {
  return prisma.user.findMany({
    where: { isEarlyAdopter },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Find a user by their Stripe subscription ID. For webhook lookups and subscription management.
 */
export const getUserBySubscriptionId = async (subscriptionId: string) => {
  return prisma.user.findFirst({
    where: { subscriptionId },
  })
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/**
 * Resolve profile path segment to user: by id first, then by slugified username.
 */
export const getUserByProfileSlug = async (slug: string) => {
  const byId = await getUserById(slug)
  if (byId) return byId
  const users = await prisma.user.findMany({
    where: { username: { not: null } },
    select: { id: true, username: true },
  })
  const match = users.find(
    (u) => u.username && slugify(u.username) === slug
  )
  return match ? getUserById(match.id) : null
}

export type UpdateUserProfilePayload = {
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email?: string
  traderAbout?: string | null
}

export const updateUser = async (
  userId: string,
  payload: UpdateUserProfilePayload
) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      username: payload.username ?? undefined,
      email: payload.email,
      traderAbout: payload.traderAbout === undefined ? undefined : payload.traderAbout,
    },
  })
}
