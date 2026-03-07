import { describe, expect, it } from "vitest"
import {
  generateSecurePassword,
  validatePasswordComplexity,
} from "./password-security.server"

describe("generateSecurePassword", () => {
  it("returns password of default length 16", () => {
    const password = generateSecurePassword()
    expect(password).toHaveLength(16)
  })

  it("returns password of requested length", () => {
    expect(generateSecurePassword(12)).toHaveLength(12)
    expect(generateSecurePassword(24)).toHaveLength(24)
    expect(generateSecurePassword(8)).toHaveLength(8)
  })

  it("generated password passes validatePasswordComplexity", () => {
    for (let i = 0; i < 5; i++) {
      const password = generateSecurePassword()
      const result = validatePasswordComplexity(password)
      expect(result.isValid, result.errors.join("; ")).toBe(true)
    }
  })

  it("includes at least one of each required character type", () => {
    const password = generateSecurePassword(12)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[!@#$%^&*]/)
  })

  it("generates different passwords on multiple calls", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const password = generateSecurePassword()
      expect(seen.has(password)).toBe(false)
      seen.add(password)
    }
  })

  it("only uses characters from the defined charset", () => {
    const charset = /^[A-Za-z0-9!@#$%^&*]+$/
    for (let i = 0; i < 5; i++) {
      const password = generateSecurePassword(20)
      expect(password).toMatch(charset)
    }
  })
})
