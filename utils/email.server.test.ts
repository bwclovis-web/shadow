import { afterEach, describe, expect, it, vi } from "vitest"

import { getAppBaseUrl } from "./email.server"

describe("getAppBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses NEXT_PUBLIC_APP_URL when provided", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shadow.example/")

    expect(getAppBaseUrl()).toBe("https://shadow.example")
  })

  it("falls back to the production domain when env is missing", () => {
    expect(getAppBaseUrl()).toBe("https://perfumershollow.com")
  })

  it("falls back to the production domain when env is blank", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "   ")

    expect(getAppBaseUrl()).toBe("https://perfumershollow.com")
  })
})
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null }),
}))

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendEmailMock,
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
    sendEmailMock.mockClear()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetEmailClientForTests()
  })

  it("returns sent:false when EMAIL_FROM format is invalid", async () => {
    process.env.EMAIL_FROM = "perfumer's hollow"
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

  it("passes html through to Resend when provided", async () => {
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "HTML Test",
      text: "Hello",
      html: "<strong>Hello</strong>",
    })

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: "<strong>Hello</strong>",
      })
    )
  })

  it("passes replyTo through to Resend when provided", async () => {
    await sendTransactionalEmail({
      to: "inbox@example.com",
      subject: "Contact",
      text: "Hello",
      replyTo: "visitor@example.com",
    })

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: "visitor@example.com",
      })
    )
  })

  it("passes attachments through to Resend when provided", async () => {
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Attachment Test",
      text: "Hello",
      attachments: [
        {
          filename: "logo-one-email.png",
          path: "C:/repos/shadow/public/images/new/logo-one-email.png",
          contentType: "image/png",
          contentId: "ph-logo",
        },
      ],
    })

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "logo-one-email.png",
            path: "C:/repos/shadow/public/images/new/logo-one-email.png",
            contentType: "image/png",
            contentId: "ph-logo",
          }),
        ],
      })
    )
  })
})
