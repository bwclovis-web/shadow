import { describe, expect, it } from "vitest"
import {
  isBlockedIpAddress,
  validateSafeHttpUrl,
} from "@/utils/server/safe-fetch-url.server"

describe("isBlockedIpAddress", () => {
  it("blocks loopback and private IPv4 ranges", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true)
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true)
    expect(isBlockedIpAddress("192.168.1.1")).toBe(true)
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true)
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true)
  })

  it("allows public IPv4", () => {
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false)
    expect(isBlockedIpAddress("1.1.1.1")).toBe(false)
  })

  it("blocks IPv6 loopback and ULA", () => {
    expect(isBlockedIpAddress("::1")).toBe(true)
    expect(isBlockedIpAddress("fc00::1")).toBe(true)
    expect(isBlockedIpAddress("fe80::1")).toBe(true)
  })
})

describe("validateSafeHttpUrl", () => {
  it("rejects non-http protocols", async () => {
    const r = await validateSafeHttpUrl("file:///etc/passwd")
    expect(r.ok).toBe(false)
  })

  it("rejects localhost hostnames", async () => {
    const r = await validateSafeHttpUrl("http://localhost/admin")
    expect(r.ok).toBe(false)
  })

  it("rejects literal private IPs", async () => {
    const r = await validateSafeHttpUrl("http://169.254.169.254/latest/meta-data/")
    expect(r.ok).toBe(false)
  })

  it("rejects URLs with credentials", async () => {
    const r = await validateSafeHttpUrl("https://user:pass@example.com/")
    expect(r.ok).toBe(false)
  })

  it("accepts a public https URL", async () => {
    const r = await validateSafeHttpUrl("https://example.com/collection")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.url.hostname).toBe("example.com")
  })
})
