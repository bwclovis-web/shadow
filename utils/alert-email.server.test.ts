import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  sendDecantInterestAlertEmail,
  sendWishlistAlertEmail,
  shouldSendDecantEmail,
  shouldSendWishlistEmail,
} from "./alert-email.server"

vi.mock("@/utils/email.server", () => ({
  getAppBaseUrl: () => "https://example.com",
  isSendableRecipientEmail: (email: string | null | undefined) =>
    !!email && !email.startsWith("deleted_"),
  sendTransactionalEmail: vi.fn().mockResolvedValue({ sent: true, id: "msg-1" }),
}))

import { sendTransactionalEmail } from "@/utils/email.server"

const basePrefs = {
  wishlistAlertsEnabled: true,
  decantAlertsEnabled: true,
  emailWishlistAlerts: true,
  emailDecantAlerts: true,
}

const recipient = {
  id: "user-1",
  email: "trader@example.com",
  firstName: "Jane",
  lastName: "Doe",
  username: "janedoe",
  profileSlug: "janedoe",
}

describe("shouldSendWishlistEmail", () => {
  it("returns true only when in-app and email prefs are enabled", () => {
    expect(shouldSendWishlistEmail(basePrefs)).toBe(true)
    expect(
      shouldSendWishlistEmail({ ...basePrefs, emailWishlistAlerts: false })
    ).toBe(false)
    expect(
      shouldSendWishlistEmail({ ...basePrefs, wishlistAlertsEnabled: false })
    ).toBe(false)
  })
})

describe("shouldSendDecantEmail", () => {
  it("returns true only when in-app and email prefs are enabled", () => {
    expect(shouldSendDecantEmail(basePrefs)).toBe(true)
    expect(
      shouldSendDecantEmail({ ...basePrefs, emailDecantAlerts: false })
    ).toBe(false)
    expect(
      shouldSendDecantEmail({ ...basePrefs, decantAlertsEnabled: false })
    ).toBe(false)
  })
})

describe("sendWishlistAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends email when dependent prefs are enabled", async () => {
    await sendWishlistAlertEmail({
      user: recipient,
      preferences: basePrefs,
      perfumeName: "Noir Epices",
      perfumeSlug: "noir-epices",
      message: "Noir Epices is now available.",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "trader@example.com",
        subject: expect.stringContaining("Noir Epices"),
        text: expect.stringContaining("https://example.com/perfume/noir-epices"),
      })
    )
  })

  it("does not send when email pref is off", async () => {
    await sendWishlistAlertEmail({
      user: recipient,
      preferences: { ...basePrefs, emailWishlistAlerts: false },
      perfumeName: "Noir Epices",
      perfumeSlug: "noir-epices",
      message: "Noir Epices is now available.",
    })

    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("does not send to deleted accounts", async () => {
    await sendWishlistAlertEmail({
      user: { ...recipient, email: "deleted_123_trader@example.com" },
      preferences: basePrefs,
      perfumeName: "Noir Epices",
      perfumeSlug: "noir-epices",
      message: "Noir Epices is now available.",
    })

    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })
})

describe("sendDecantInterestAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends email when dependent prefs are enabled", async () => {
    await sendDecantInterestAlertEmail({
      user: recipient,
      preferences: basePrefs,
      perfumeName: "Rose Oud",
      perfumeSlug: "rose-oud",
      message: "Someone added Rose Oud to their wishlist.",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "trader@example.com",
        subject: expect.stringContaining("Rose Oud"),
      })
    )
  })

  it("does not send when in-app decant alert is disabled", async () => {
    await sendDecantInterestAlertEmail({
      user: recipient,
      preferences: { ...basePrefs, decantAlertsEnabled: false },
      perfumeName: "Rose Oud",
      perfumeSlug: "rose-oud",
      message: "Someone added Rose Oud to their wishlist.",
    })

    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })
})
