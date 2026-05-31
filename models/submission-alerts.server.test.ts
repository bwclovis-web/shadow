import { beforeEach, describe, expect, it, vi } from "vitest"

const createUserAlertMock = vi.fn()
const dispatchPushForUserAlertMock = vi.fn()
const getUserAlertPreferencesMock = vi.fn()
const sendSubmissionOutcomeEmailMock = vi.fn()
const prismaUserFindUniqueMock = vi.fn()

vi.mock("@/models/user-alerts.server", () => ({
  createUserAlert: (...args: unknown[]) => createUserAlertMock(...args),
  dispatchPushForUserAlert: (...args: unknown[]) => dispatchPushForUserAlertMock(...args),
  getUserAlertPreferences: (...args: unknown[]) => getUserAlertPreferencesMock(...args),
}))

vi.mock("@/utils/alert-email.server", () => ({
  sendSubmissionOutcomeEmail: (...args: unknown[]) => sendSubmissionOutcomeEmailMock(...args),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => prismaUserFindUniqueMock(...args),
    },
  },
}))

import {
  notifySubmissionRejected,
  notifySubmitterOfSubmissionOutcome,
} from "./submission-alerts.server"

describe("submission-alerts.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserAlertPreferencesMock.mockResolvedValue({
      emailSubmissionAlerts: false,
      pushSubmissionAlerts: true,
    })
    prismaUserFindUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      profileSlug: "testuser",
    })
    createUserAlertMock.mockResolvedValue({ id: "alert-1" })
    sendSubmissionOutcomeEmailMock.mockResolvedValue(undefined)
  })

  it("creates a submission_rejected alert for the submitter", async () => {
    await notifySubmissionRejected({
      submitterId: "user-1",
      submissionId: "submission-1",
      submissionType: "perfume",
      submissionData: { name: "Mystery Scent" },
      adminNotes: "Duplicate entry",
    })

    expect(createUserAlertMock).toHaveBeenCalledTimes(1)
    expect(createUserAlertMock).toHaveBeenCalledWith(
      "user-1",
      null,
      "submission_rejected",
      '"Mystery Scent" was not approved for the Archive',
      expect.stringContaining("Duplicate entry"),
      expect.objectContaining({
        submissionId: "submission-1",
        submissionType: "perfume",
        submissionName: "Mystery Scent",
        adminNotes: "Duplicate entry",
        targetUrl: "/testuser/profile/my-scents",
      }),
      expect.objectContaining({ pushSubmissionAlerts: true })
    )
    expect(dispatchPushForUserAlertMock).toHaveBeenCalledTimes(1)
  })

  it("skips notification when submitterId is missing", async () => {
    await notifySubmissionRejected({
      submitterId: null,
      submissionId: "submission-1",
      submissionType: "perfume",
      submissionData: { name: "Mystery Scent" },
    })

    expect(createUserAlertMock).not.toHaveBeenCalled()
  })

  it("uses rejection message without notes when adminNotes are blank", async () => {
    await notifySubmitterOfSubmissionOutcome({
      submitterId: "user-1",
      alertType: "submission_rejected",
      submissionId: "submission-1",
      submissionType: "perfume_house",
      submissionName: "New House",
      adminNotes: "   ",
    })

    expect(createUserAlertMock).toHaveBeenCalledWith(
      "user-1",
      null,
      "submission_rejected",
      expect.stringContaining("New House"),
      expect.stringContaining("removed from your collection"),
      expect.objectContaining({ adminNotes: null }),
      expect.any(Object)
    )
  })
})
