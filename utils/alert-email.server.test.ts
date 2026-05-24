import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  sendDecantInterestAlertEmail,
  sendTradeEventEmail,
  sendWishlistAlertEmail,
  shouldSendDecantEmail,
  shouldSendSecurityEmail,
  shouldSendTradeEmail,
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
  emailTradeAlerts: true,
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

describe("shouldSendTradeEmail", () => {
  it("returns true only when emailTradeAlerts is enabled", () => {
    expect(shouldSendTradeEmail(basePrefs)).toBe(true)
    expect(shouldSendTradeEmail({ ...basePrefs, emailTradeAlerts: false })).toBe(false)
  })
})

describe("shouldSendSecurityEmail", () => {
  it("returns true by default when security prefs are enabled", () => {
    expect(
      shouldSendSecurityEmail({
        ...basePrefs,
        securityAlertsEnabled: true,
        emailSecurityAlerts: true,
      })
    ).toBe(true)
  })

  it("returns false when email or in-app security alerts are disabled", () => {
    expect(
      shouldSendSecurityEmail({
        ...basePrefs,
        securityAlertsEnabled: false,
        emailSecurityAlerts: true,
      })
    ).toBe(false)
    expect(
      shouldSendSecurityEmail({
        ...basePrefs,
        securityAlertsEnabled: true,
        emailSecurityAlerts: false,
      })
    ).toBe(false)
  })
})

describe("sendTradeEventEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends email for trade milestones when pref is enabled", async () => {
    await sendTradeEventEmail({
      user: recipient,
      preferences: basePrefs,
      alertType: "trade_accepted",
      title: "Jane accepted your trade",
      message: "Regarding Noir Epices",
      actorUserId: "actor-2",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "trader@example.com",
        subject: "Jane accepted your trade",
        text: expect.stringContaining("https://example.com/exchanges/actor-2"),
      })
    )
  })

  it("does not send for trade_cancelled", async () => {
    await sendTradeEventEmail({
      user: recipient,
      preferences: basePrefs,
      alertType: "trade_cancelled",
      title: "Trade cancelled",
      message: "Regarding Noir Epices",
      actorUserId: "actor-2",
    })

    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it("does not send when email pref is off", async () => {
    await sendTradeEventEmail({
      user: recipient,
      preferences: { ...basePrefs, emailTradeAlerts: false },
      alertType: "trade_shipped",
      title: "Jane marked your trade as shipped",
      message: "Regarding Noir Epices",
      actorUserId: "actor-2",
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
