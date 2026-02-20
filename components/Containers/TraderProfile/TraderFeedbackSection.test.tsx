import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TraderFeedbackResponse } from "~/lib/queries/traderFeedback"

import { renderWithProviders } from "../../../../test/utils/test-utils"
import TraderFeedbackSection from "./TraderFeedbackSection"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      const translations: Record<string, string> = {
        "traderProfile.feedback.title": "Trader Feedback",
        "traderProfile.feedback.subtitle":
          "Build trust with ratings and comments from the community.",
        "traderProfile.feedback.badgeLabel": "Trusted Trader",
        "traderProfile.feedback.noComments": "No feedback comments yet.",
        "traderProfile.feedback.loginPrompt":
          "Sign in to leave feedback and help build community trust.",
        "traderProfile.feedback.ratingLabel": "Your rating",
        "traderProfile.feedback.commentLabel": "Your comment",
        "traderProfile.feedback.selectRating": "Select rating",
        "traderProfile.feedback.ratingHint":
          "Score trades from 1 (needs improvement) to 5 (excellent).",
        "traderProfile.feedback.commentHint":
          "Comments are optional and help other members decide who to trust.",
        "traderProfile.feedback.submitButton": "Submit feedback",
        "traderProfile.feedback.updateButton": "Update feedback",
        "traderProfile.feedback.deleteButton": "Remove feedback",
        "traderProfile.feedback.anonymousReviewer": "Anonymous reviewer",
        "traderProfile.feedback.noRatings": "No ratings yet",
        "traderProfile.feedback.loading": "Loading feedback...",
        "traderProfile.feedback.error":
          "We couldn't load trader feedback right now.",
        "traderProfile.feedback.commentPlaceholder":
          "Share details about your experience trading with this member.",
        "traderProfile.feedback.selfReviewNotice":
          "You cannot leave feedback on your own profile.",
      }

      if (key === "traderProfile.feedback.reviewCount") {
        const count = options?.count ?? 0
        return `${count} review${count === 1 ? "" : "s"}`
      }

      if (key === "traderProfile.heading") {
        return `Trader ${options?.traderName ?? ""}`
      }

      return translations[key] ?? key
    },
  }),
}))

const submitMutationMock = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}

const deleteMutationMock = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}

const mockUseTraderFeedback = vi.fn()

vi.mock("~/hooks/useTraderFeedback", () => ({
  useTraderFeedback: (...args: any[]) => mockUseTraderFeedback(...args),
  useTraderFeedbackMutations: () => ({
    submitFeedback: submitMutationMock.mutate,
    deleteFeedback: deleteMutationMock.mutate,
    submitMutation: submitMutationMock,
    deleteMutation: deleteMutationMock,
    isMutating: false,
  }),
}))

describe("TraderFeedbackSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTraderFeedback.mockReset()
    submitMutationMock.mutate.mockReset()
    deleteMutationMock.mutate.mockReset()
  })

  it("shows feedback summary and comments when data is available", () => {
    const feedbackData: TraderFeedbackResponse = {
      summary: {
        traderId: "trader-1",
        averageRating: 4.5,
        totalReviews: 12,
        badgeEligible: true,
      },
      comments: [
        {
          id: "feedback-1",
          traderId: "trader-1",
          reviewerId: "user-2",
          rating: 5,
          comment: "Great trade experience!",
          createdAt: new Date("2024-01-05").toISOString(),
          updatedAt: new Date("2024-01-05").toISOString(),
          reviewer: {
            id: "user-2",
            firstName: "Alex",
            lastName: "Smith",
            username: "alex-smith",
          },
        },
      ],
      viewerFeedback: null,
    }

    mockUseTraderFeedback.mockReturnValue({
      data: feedbackData,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderWithProviders(<TraderFeedbackSection traderId="trader-1" viewerId="user-1" />)

    expect(screen.getByText("Trader Feedback")).toBeInTheDocument()
    expect(screen.getByText("Trusted Trader")).toBeInTheDocument()
    expect(screen.getByText("4.5")).toBeInTheDocument()
    expect(screen.getByText("12 reviews")).toBeInTheDocument()
    expect(screen.getByText("Great trade experience!")).toBeInTheDocument()
    expect(screen.getByText("alex-smith")).toBeInTheDocument()
  })

  it("prompts user to sign in when viewer is missing", () => {
    const feedbackData: TraderFeedbackResponse = {
      summary: {
        traderId: "trader-2",
        averageRating: null,
        totalReviews: 0,
        badgeEligible: false,
      },
      comments: [],
      viewerFeedback: null,
    }

    mockUseTraderFeedback.mockReturnValue({
      data: feedbackData,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderWithProviders(<TraderFeedbackSection traderId="trader-2" />)

    expect(screen.getByText("Sign in to leave feedback and help build community trust.")).toBeInTheDocument()
    expect(screen.queryByText("Submit feedback")).not.toBeInTheDocument()
  })

  it("passes initial loader data to the feedback hook", () => {
    const initialFeedback: TraderFeedbackResponse = {
      summary: {
        traderId: "trader-3",
        averageRating: 3.5,
        totalReviews: 4,
        badgeEligible: false,
      },
      comments: [],
      viewerFeedback: {
        traderId: "trader-3",
        reviewerId: "viewer-1",
        rating: 4,
        comment: "Solid trade.",
        createdAt: new Date("2024-02-01").toISOString(),
        updatedAt: new Date("2024-02-01").toISOString(),
      },
    }

    mockUseTraderFeedback.mockReturnValue({
      data: initialFeedback,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderWithProviders(<TraderFeedbackSection
        traderId="trader-3"
        viewerId="viewer-1"
        initialData={initialFeedback}
      />)

    expect(mockUseTraderFeedback).toHaveBeenCalledWith("trader-3", "viewer-1", initialFeedback)
    expect(screen.getByDisplayValue("Solid trade.")).toBeInTheDocument()
  })
})

