import { beforeEach, describe, expect, it, vi } from "vitest"

import { usernameSchema } from "@/utils/validation/fieldSchemas"

vi.mock("@/models/user.query", () => ({
  getUserByName: vi.fn(),
}))

import { getUserByName } from "@/models/user.query"
import { generateUniqueUsername } from "./username-generator.server"

const mockGetUserByName = vi.mocked(getUserByName)

describe("generateUniqueUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserByName.mockResolvedValue(null)
  })

  it("returns a string that passes usernameSchema (3–30 chars, letters, numbers, spaces, underscores)", async () => {
    const username = await generateUniqueUsername()
    const parsed = usernameSchema.safeParse(username)
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.flatten())).toBe(true)
    expect(username.length).toBeGreaterThanOrEqual(3)
    expect(username.length).toBeLessThanOrEqual(30)
    expect(username).toMatch(/^[a-zA-Z0-9_\s]+$/)
  })

  it("calls getUserByName to check uniqueness", async () => {
    await generateUniqueUsername()
    expect(mockGetUserByName).toHaveBeenCalledTimes(1)
    expect(mockGetUserByName).toHaveBeenCalledWith(expect.any(String))
  })

  it("returns username in 'Word Word' or 'Word Word_Number' format", async () => {
    for (let i = 0; i < 15; i++) {
      const username = await generateUniqueUsername()
      const hasNumberSuffix = /^[A-Za-z]+ [A-Za-z]+_[0-9]+$/.test(username)
      const twoWordsOnly = /^[A-Za-z]+ [A-Za-z]+$/.test(username)
      expect(hasNumberSuffix || twoWordsOnly, `expected 'Word Word' or 'Word Word_Number', got: ${username}`).toBe(true)
    }
  })

  it("retries when username is taken until an available one is found", async () => {
    let callCount = 0
    mockGetUserByName.mockImplementation(async () => {
      callCount++
      return callCount <= 3 ? ({ id: "taken" } as any) : null
    })
    const username = await generateUniqueUsername()
    expect(mockGetUserByName).toHaveBeenCalledTimes(4)
    expect(usernameSchema.safeParse(username).success).toBe(true)
  })

  it("throws when all retries and fallback are taken", async () => {
    mockGetUserByName.mockResolvedValue({ id: "always-taken" } as any)
    await expect(generateUniqueUsername()).rejects.toThrow(
      "Username generator: could not produce a unique username after retries and fallback suffix"
    )
  })

  it("generates different usernames on multiple calls", async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 25; i++) {
      const username = await generateUniqueUsername()
      expect(seen.has(username), `duplicate username: ${username}`).toBe(false)
      seen.add(username)
    }
  })
})
