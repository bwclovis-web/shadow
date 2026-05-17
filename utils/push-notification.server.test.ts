import { describe, expect, it } from "vitest"

import { buildPushAlertPayload } from "@/utils/push-notification.server"

describe("buildPushAlertPayload", () => {
  it("links trade alerts to the message thread with the actor", () => {
    const payload = buildPushAlertPayload(
      "trade_accepted",
      "Trade accepted",
      "Regarding Rose",
      { tradeId: "trade-1", senderId: "user-actor" }
    )
    expect(payload.url).toContain("/messages/user-actor")
    expect(payload.tag).toContain("trade_accepted")
  })

  it("links new messages to the sender thread", () => {
    const payload = buildPushAlertPayload(
      "new_trader_message",
      "New message",
      "Hello",
      { senderId: "user-sender", messageId: "msg-1" }
    )
    expect(payload.url).toContain("/messages/user-sender")
  })
})
