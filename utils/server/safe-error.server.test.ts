import { describe, expect, it } from "vitest"
import { createCorrelationId, safeJsonError } from "@/utils/server/safe-error.server"

describe("safeJsonError", () => {
  it("returns public message and correlation id without leaking cause", async () => {
    const res = safeJsonError({
      cause: new Error("SECRET_DB_CONNECTION_STRING"),
      publicMessage: "Something went wrong",
      correlationId: "req_test123",
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Something went wrong")
    expect(body.correlationId).toBe("req_test123")
    expect(JSON.stringify(body)).not.toContain("SECRET_DB")
  })

  it("createCorrelationId is stable format", () => {
    expect(createCorrelationId()).toMatch(/^req_/)
  })
})
