/**
 * Server-only random username generator (film noir themed).
 * Produces usernames like "Dark Alley" or "Pale Shadow_42"; spaces allowed, URLs use hyphenated slug (e.g. /dark-alley/profile).
 */

import { randomInt } from "node:crypto"

import { getUserByName } from "@/models/user.query"

const ADJECTIVES = [
  "Dark",
  "Pale",
  "Cold",
  "Grim",
  "Bleak",
  "Hollow",
  "Lonely",
  "Murky",
  "Quiet",
  "Rough",
  "Sharp",
  "Silent",
  "Stark",
  "Stern",
  "Twisted",
  "Weary",
  "Broken",
  "Lost",
  "Noir",
  "Phantom",
  "Raven",
  "Scarlet",
  "Silver",
  "Velvet",
  "Midnight",
  "Shadowy",
  "Cynical",
  "Fatal",
  "Smoky",
  "Dusky",
  "Misty",
  "Foggy",
  "Steely",
  "Sullen",
  "Wary",
  "Bitter",
  "Sly",
  "Slick",
  "Smooth",
  "Hard",
  "Soft",
  "Low",
  "Deep",
  "Quick",
  "Swift",
  "Late",
  "Last",
  "Dead",
  "Double",
  "Secret",
  "Hidden",
  "Blind",
  "Black",
  "Grey",
  "Red",
  "Blue",
  "White",
  "Gold",
  "Chrome",
]

const NOUNS = [
  "Shadow",
  "Rain",
  "Smoke",
  "Alley",
  "Night",
  "Neon",
  "Jazz",
  "Cipher",
  "Secret",
  "Dame",
  "Blade",
  "Ghost",
  "Raven",
  "Crow",
  "Wolf",
  "Snake",
  "Spider",
  "Shade",
  "Veil",
  "Fog",
  "Mist",
  "Bullet",
  "Fedora",
  "Trench",
  "Whiskey",
  "Ashes",
  "Ember",
  "Flame",
  "Spark",
  "Murmur",
  "Echo",
  "Silence",
  "Street",
  "Lamp",
  "Door",
  "Key",
  "Code",
  "Case",
  "File",
  "Lead",
  "Tip",
  "Trail",
  "Mark",
  "Score",
  "Deal",
  "Hand",
  "Eye",
  "Heart",
  "Bone",
  "Sin",
  "Vice",
  "Fate",
  "Doom",
  "Doubt",
  "Trust",
  "Lie",
  "Truth",
  "Clue",
  "Proof",
]

const MAX_USERNAME_LENGTH = 30
const NUM_SUFFIX_MAX = 9999
const MAX_RETRIES = 10

/**
 * Picks a random element from an array using crypto.randomInt.
 */
function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length)]
}

/**
 * Generates a single candidate username: "Word Word" or "Word Word_Number".
 * Spaces are allowed; URLs use hyphenated slug via getProfileSlug.
 * Keeps total length ≤ 30.
 */
function generateCandidate(): string {
  const adj = pick(ADJECTIVES)
  const noun = pick(NOUNS)
  const base = `${adj} ${noun}`
  const withSuffix = `${base}_${randomInt(1, NUM_SUFFIX_MAX + 1)}`
  const useNumber = randomInt(0, 2) === 1
  const candidate = useNumber ? withSuffix : base
  return candidate.length <= MAX_USERNAME_LENGTH ? candidate : base
}

/**
 * Generates a short random suffix (digits) to force uniqueness when retries are exhausted.
 */
function randomSuffix(): string {
  return String(randomInt(1000, 10000))
}

/**
 * Returns a username that is unique in the database.
 * Tries up to MAX_RETRIES candidates; if all collide, appends a random numeric suffix and returns.
 */
export async function generateUniqueUsername(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const candidate = generateCandidate()
    const existing = await getUserByName(candidate)
    if (!existing) return candidate
  }
  const base = `${pick(ADJECTIVES)} ${pick(NOUNS)}`
  const suffix = randomSuffix()
  const final = `${base.slice(0, MAX_USERNAME_LENGTH - 5)}_${suffix}`.slice(0, MAX_USERNAME_LENGTH)
  const again = await getUserByName(final)
  if (!again) return final
  throw new Error(
    "Username generator: could not produce a unique username after retries and fallback suffix"
  )
}
