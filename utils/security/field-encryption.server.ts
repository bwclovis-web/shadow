import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const getEncryptionKey = (): Buffer => {
  const raw = process.env.TOTP_ENCRYPTION_KEY
  if (!raw?.trim()) {
    throw new Error("TOTP_ENCRYPTION_KEY environment variable is required")
  }
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex")
  }
  const decoded = Buffer.from(trimmed, "base64")
  if (decoded.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44-char base64)")
  }
  return decoded
}

/** AES-256-GCM encrypt; returns base64(iv + authTag + ciphertext). */
export const encryptField = (plaintext: string): string => {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

/** Decrypt value produced by encryptField. */
export const decryptField = (encoded: string): string => {
  const key = getEncryptionKey()
  const data = Buffer.from(encoded, "base64")
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted field")
  }
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  )
}
