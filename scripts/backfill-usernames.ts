/**
 * One-off backfill: set username for all users where username is null.
 * Run from project root: npx tsx scripts/backfill-usernames.ts
 * Run this before changing the schema to username String (NOT NULL) and running db push.
 */

import { PrismaClient } from "@prisma/client"
import { randomInt } from "node:crypto"

const prisma = new PrismaClient()

const ADJECTIVES = [
  "Dark", "Pale", "Cold", "Grim", "Bleak", "Hollow", "Lonely", "Murky", "Quiet",
  "Rough", "Sharp", "Silent", "Stark", "Stern", "Noir", "Phantom", "Raven",
  "Scarlet", "Silver", "Velvet", "Midnight", "Shadowy", "Smoky", "Steely",
]
const NOUNS = [
  "Shadow", "Rain", "Smoke", "Alley", "Night", "Neon", "Jazz", "Cipher",
  "Secret", "Ghost", "Raven", "Shade", "Veil", "Fog", "Mist", "Fedora",
  "Whiskey", "Flame", "Street", "Lamp", "Case", "Code", "Trail", "Clue",
]

const MAX_LEN = 30
const MAX_RETRIES = 10

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length)]
}

function randomSuffix(): string {
  return String(randomInt(1000, 10000))
}

function generateCandidate(): string {
  const adj = pick(ADJECTIVES)
  const noun = pick(NOUNS)
  const base = `${adj} ${noun}`
  const withNum = `${base}_${randomInt(1, 10000)}`
  return randomInt(0, 2) === 1 ? withNum : base
}

async function findUserByUsername(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  })
}

async function generateUniqueUsername(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const candidate = generateCandidate()
    const existing = await findUserByUsername(candidate)
    if (!existing) return candidate
  }
  const base = `${pick(ADJECTIVES)} ${pick(NOUNS)}`
  const suffix = randomSuffix()
  const final = `${base.slice(0, MAX_LEN - 5)}_${suffix}`.slice(0, MAX_LEN)
  const again = await findUserByUsername(final)
  if (!again) return final
  throw new Error("Could not generate a unique username after retries")
}

async function main() {
  // Raw query: Prisma client may already have username as required (String), so
  // where: { username: null } is invalid. Query the DB directly for null/empty.
  const usersWithoutUsername = await prisma.$queryRaw<
    { id: string; email: string }[]
  >`
    SELECT id, email FROM "User"
    WHERE username IS NULL OR trim(username) = ''
  `

  if (usersWithoutUsername.length === 0) {
    console.log("No users with null or empty username. Nothing to do.")
    return
  }

  console.log(`Found ${usersWithoutUsername.length} user(s) without username. Backfilling...`)

  for (const user of usersWithoutUsername) {
    const username = await generateUniqueUsername()
    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    })
    console.log(`  ${user.email} -> ${username}`)
  }

  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
