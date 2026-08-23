/**
 * Additive E2E seed — upserts free/premium/admin users, minimal catalog, quiz materials.
 * Usage: npm run test:e2e:seed
 *
 * Does not truncate or drop data. Safe to re-run.
 */
process.env.DOTENV_CONFIG_QUIET = "true"
import "dotenv/config"

import fs from "node:fs"
import path from "node:path"

import { MembershipTier, UserRole } from "@prisma/client"

import {
  E2E_HOUSE_SLUG,
  E2E_PASSWORD,
  E2E_PERFUME_SLUGS,
  E2E_USERS,
} from "../e2e/constants"
import { prisma } from "../lib/db"
import { allocateUniqueProfileSlug } from "../utils/profile-slug.server"
import { hashPassword } from "../utils/security/password-security.server"

const upsertUser = async (opts: {
  email: string
  username: string
  membershipTier: MembershipTier
  role: UserRole
}) => {
  const passwordHash = await hashPassword(E2E_PASSWORD)
  const existing = await prisma.user.findUnique({ where: { email: opts.email } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        password: passwordHash,
        username: opts.username,
        membershipTier: opts.membershipTier,
        role: opts.role,
        isBanned: false,
        // Paid participation required for Model A APIs; tier still controls entitlements.
        subscriptionStatus: "paid",
      },
    })
  }

  const profileSlug = await allocateUniqueProfileSlug(prisma, opts.username, null)

  return prisma.user.create({
    data: {
      email: opts.email,
      password: passwordHash,
      username: opts.username,
      profileSlug,
      membershipTier: opts.membershipTier,
      role: opts.role,
      subscriptionStatus: "paid",
      firstName: "E2E",
      lastName: opts.username,
    },
  })
}

const seedCatalog = async () => {
  const house = await prisma.perfumeHouse.upsert({
    where: { slug: E2E_HOUSE_SLUG },
    create: {
      name: "E2E Test House",
      slug: E2E_HOUSE_SLUG,
      type: "indie",
      description: "Synthetic house for Playwright e2e",
    },
    update: {
      name: "E2E Test House",
      description: "Synthetic house for Playwright e2e",
    },
  })

  const perfumes = []
  for (const slug of E2E_PERFUME_SLUGS) {
    const name =
      slug === "e2e-amber-smoke" ? "E2E Amber Smoke" : "E2E Citrus Breeze"
    const perfume = await prisma.perfume.upsert({
      where: { slug },
      create: {
        name,
        slug,
        perfumeHouseId: house.id,
        description: `${name} for e2e tests`,
        isPending: false,
      },
      update: {
        name,
        perfumeHouseId: house.id,
        isPending: false,
      },
    })
    perfumes.push(perfume)
  }
  return { house, perfumes }
}

const seedNoteMaterials = async () => {
  const materials = [
    { slug: "e2e-bergamot", name: "E2E Bergamot", family: "citrus" },
    { slug: "e2e-cedar", name: "E2E Cedar", family: "woody" },
    { slug: "e2e-vanilla", name: "E2E Vanilla", family: "gourmand" },
    { slug: "e2e-rose", name: "E2E Rose", family: "floral" },
    { slug: "e2e-musk", name: "E2E Musk", family: "musky" },
  ]
  for (const m of materials) {
    await prisma.noteMaterial.upsert({
      where: { slug: m.slug },
      create: m,
      update: { name: m.name, family: m.family },
    })
  }
}

const seedPublicShelf = async (ownerId: string, perfumeId: string) => {
  const existing = await prisma.collectionShelf.findFirst({
    where: { userId: ownerId, name: "E2E Public Shelf" },
  })
  if (existing) {
    await prisma.collectionShelf.update({
      where: { id: existing.id },
      data: { isPublic: true },
    })
    await prisma.collectionShelfItem.upsert({
      where: {
        shelfId_perfumeId: { shelfId: existing.id, perfumeId },
      },
      create: { shelfId: existing.id, perfumeId },
      update: {},
    })
    return existing
  }
  return prisma.collectionShelf.create({
    data: {
      userId: ownerId,
      name: "E2E Public Shelf",
      description: "Visible to signed-out browsers",
      isPublic: true,
      items: {
        create: [{ perfumeId }],
      },
    },
  })
}

const seedWishlist = async (userId: string, perfumeId: string) => {
  const found = await prisma.userPerfumeWishlist.findFirst({
    where: { userId, perfumeId },
  })
  if (found) {
    await prisma.userPerfumeWishlist.update({
      where: { id: found.id },
      data: { isPublic: false },
    })
    return
  }
  await prisma.userPerfumeWishlist.create({
    data: { userId, perfumeId, isPublic: false },
  })
}

const main = async () => {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for e2e seed")
  }

  console.log("Seeding E2E users and catalog…")
  const free = await upsertUser({
    ...E2E_USERS.free,
    membershipTier: MembershipTier.free,
    role: UserRole.user,
  })
  const premium = await upsertUser({
    ...E2E_USERS.premium,
    membershipTier: MembershipTier.premium,
    role: UserRole.user,
  })
  const admin = await upsertUser({
    ...E2E_USERS.admin,
    membershipTier: MembershipTier.free,
    role: UserRole.admin,
  })
  await seedNoteMaterials()
  const { perfumes } = await seedCatalog()
  await seedPublicShelf(premium.id, perfumes[0]!.id)
  await seedWishlist(free.id, perfumes[0]!.id)
  await seedWishlist(premium.id, perfumes[1]!.id)

  console.log("E2E seed complete:")
  console.log(`  free:    ${free.email} (${free.id})`)
  console.log(`  premium: ${premium.email} (${premium.id})`)
  console.log(`  admin:   ${admin.email} (${admin.id})`)
  console.log(`  perfumes: ${perfumes.map((p) => p.slug).join(", ")}`)

  const metaDir = path.join(process.cwd(), "e2e", ".auth")
  fs.mkdirSync(metaDir, { recursive: true })
  const meta = {
    freeUserId: free.id,
    premiumUserId: premium.id,
    adminUserId: admin.id,
    freeProfileSlug: free.profileSlug ?? free.username,
    premiumProfileSlug: premium.profileSlug ?? premium.username,
    perfumeIds: perfumes.map((p) => ({ id: p.id, slug: p.slug, name: p.name })),
  }
  fs.writeFileSync(
    path.join(metaDir, "seed-meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  )
  console.log("  wrote e2e/.auth/seed-meta.json")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
