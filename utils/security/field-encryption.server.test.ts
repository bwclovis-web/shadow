import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { decryptField, encryptField } from "./field-encryption.server"

describe("field-encryption.server", () => {
  const originalKey = process.env.TOTP_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.TOTP_ENCRYPTION_KEY
    } else {
      process.env.TOTP_ENCRYPTION_KEY = originalKey
    }
  })

  it("round-trips plaintext", () => {
    const plain = "JBSWY3DPEHPK3PXP"
    const encrypted = encryptField(plain)
    expect(encrypted).not.toBe(plain)
    expect(decryptField(encrypted)).toBe(plain)
  })

  it("throws when key is missing", () => {
    delete process.env.TOTP_ENCRYPTION_KEY
    expect(() => encryptField("x")).toThrow(/TOTP_ENCRYPTION_KEY/)
  })
})
