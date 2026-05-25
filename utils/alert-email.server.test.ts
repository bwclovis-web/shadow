import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildEditorialAlertEmail,
  sendDecantInterestAlertEmail,
  sendDisputeResolutionEmail,
  sendSecurityAlertEmail,
  sendSplitEventEmail,
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
        html: expect.stringContaining("From The Exchange"),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: "logo-one-email.png",
            contentId: "ph-logo",
          }),
        ]),
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
        html: expect.stringContaining("Noir Epices"),
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
        html: expect.stringContaining("Collector interest"),
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

describe("sendSplitEventEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses the split deep link when splitId is provided", async () => {
    await sendSplitEventEmail({
      user: recipient,
      preferences: basePrefs,
      alertType: "split_shipped",
      title: "Your split is on the move",
      message: "The host marked your split as shipped.",
      splitId: "split-12345678",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("https://example.com/splits/split-12345678"),
        html: expect.stringContaining("12345678"),
      })
    )
  })
})

describe("sendSecurityAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends branded security html when enabled", async () => {
    await sendSecurityAlertEmail({
      user: recipient,
      preferences: {
        ...basePrefs,
        securityAlertsEnabled: true,
        emailSecurityAlerts: true,
      },
      title: "Sign-in from a new device",
      message: "Your account was signed in from a device we have not seen before.",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Sign-in from a new device",
        html: expect.stringContaining("Security Notice From The Hollow"),
      })
    )
  })
})

describe("sendDisputeResolutionEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders dispute resolution html with policy link", async () => {
    await sendDisputeResolutionEmail({
      user: recipient,
      disputeId: "dispute-1",
      tradeId: "trade-abcdefgh",
      outcome: "warningIssued",
      publicSummary: "The moderation team reviewed both sides and closed the case.",
    })

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Trade dispute resolution — perfumer's hollow",
        html: expect.stringContaining("community-policy#disputes"),
      })
    )
  })
})

describe("buildEditorialAlertEmail", () => {
  it("escapes unsafe content in html output", () => {
    const result = buildEditorialAlertEmail({
      variant: "wishlist",
      displayName: "Jane <Doe>",
      title: "Rare <Bottle>",
      lead: "A <script>alert('xss')</script> note",
      body: ["Body with <b>markup</b>"],
      ctaLabel: "Open listing",
      ctaUrl: "https://example.com/perfume/rare-bottle",
      spotlightLabel: "Perfume",
      spotlightValue: "Rare <Bottle>",
    })

    expect(result.html).toContain("Jane &lt;Doe&gt;")
    expect(result.html).toContain("Rare &lt;Bottle&gt;")
    expect(result.html).toContain("Perfumer&#39;s Hollow")
    expect(result.html).toContain("cid:ph-logo")
    expect(result.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "logo-one-email.png",
          contentId: "ph-logo",
        }),
      ])
    )
    expect(result.html).not.toContain("<script>alert('xss')</script>")
    expect(result.text).toContain("Rare <Bottle>")
  })
})
