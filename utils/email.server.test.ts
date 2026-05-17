import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null }),
    },
  })),
}))

import { resetEmailClientForTests, sendTransactionalEmail } from "./email.server"

describe("sendTransactionalEmail", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetEmailClientForTests()
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "Shadow <alerts@example.com>"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailClientForTests()
  })

  it("returns sent:false when EMAIL_FROM format is invalid", async () => {
    process.env.EMAIL_FROM = "Shadow and Sillage"
    resetEmailClientForTests()

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result).toEqual({ sent: false })
  })

  it("returns sent:false when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    resetEmailClientForTests()

    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result).toEqual({ sent: false })
  })

  it("sends when configured", async () => {
    const result = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })

    expect(result.sent).toBe(true)
    expect(result.id).toBe("email-1")
  })
})
