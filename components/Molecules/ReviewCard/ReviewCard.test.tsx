import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ReviewCard from "./ReviewCard"
import { useSessionStore } from "~/stores/sessionStore"

// Mock date-fns
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((date: Date, options?: { addSuffix?: boolean }) => {
    // Check if date is invalid
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date")
    }
    const now = new Date("2024-01-15T12:00:00Z")
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    let result = ""
    if (days === 0) {
      result = "today"
    } else if (days === 1) {
      result = "1 day ago"
    } else {
      result = `${days} days ago`
    }
    // Apply addSuffix option if provided (though our mock already includes "ago")
    return result
  }),
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.edit": "Edit",
        "common.delete": "Delete",
        "common.approve": "Approve",
        "common.reject": "Reject",
        "singlePerfume.review.dangerModal.heading": "Delete Review",
        "singlePerfume.review.dangerModal.description": "Are you sure you want to delete this review?",
      }
      return translations[key] || key
    },
  }),
}))

describe("ReviewCard", () => {
  const mockReview = {
    id: "review-1",
    review: "<p>This is a great perfume!</p>",
    createdAt: new Date("2024-01-10T12:00:00Z").toISOString(),
    isApproved: false,
    user: {
      id: "user-1",
      username: "testuser",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    },
  }

  beforeEach(() => {
    const portal = document.createElement("div")
    portal.setAttribute("id", "modal-portal")
    document.body.appendChild(portal)
    useSessionStore.getState().closeModal()
  })

  afterEach(() => {
    cleanup()
    document.getElementById("modal-portal")?.remove()
    useSessionStore.getState().closeModal()
  })

  describe("Rendering", () => {
    it("renders the review card with review content", () => {
      render(<ReviewCard review={mockReview} />)
      expect(screen.getByText(/This is a great perfume!/)).toBeInTheDocument()
    })

    it("renders user avatar with first letter of display name", () => {
      render(<ReviewCard review={mockReview} />)
      const avatar = screen.getByText("T")
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveClass("text-noir-dark")
    })

    it("renders the formatted date", () => {
      render(<ReviewCard review={mockReview} />)
      expect(screen.getByText("5 days ago")).toBeInTheDocument()
    })

    it("applies correct styling to the card", () => {
      const { container } = render(<ReviewCard review={mockReview} />)
      const card = container.firstChild
      expect(card).toHaveClass("bg-white/5")
      expect(card).toHaveClass("border-noir-gold")
      expect(card).toHaveClass("rounded-lg")
    })
  })

  describe("User Display Name", () => {
    it("displays username when available", () => {
      render(<ReviewCard review={mockReview} />)
      expect(screen.getByText("testuser")).toBeInTheDocument()
    })

    it("displays first and last name when username is not available", () => {
      const reviewWithoutUsername = {
        ...mockReview,
        user: { ...mockReview.user, username: null },
      }
      render(<ReviewCard review={reviewWithoutUsername} />)
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    })

    it("displays only first name when last name is not available", () => {
      const reviewWithOnlyFirstName = {
        ...mockReview,
        user: { ...mockReview.user, username: null, lastName: null },
      }
      render(<ReviewCard review={reviewWithOnlyFirstName} />)
      expect(screen.getByText("John")).toBeInTheDocument()
    })

    it("displays email as fallback when no name or username is available", () => {
      const reviewWithOnlyEmail = {
        ...mockReview,
        user: {
          ...mockReview.user,
          username: null,
          firstName: null,
          lastName: null,
        },
      }
      render(<ReviewCard review={reviewWithOnlyEmail} />)
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument()
    })

    it("creates avatar with correct first letter for each display name type", () => {
      const testCases = [
        { username: "alice", expected: "A" },
        { username: null, firstName: "Bob", lastName: "Smith", expected: "B" },
        { username: null, firstName: "Charlie", lastName: null, expected: "C" },
        {
          username: null,
          firstName: null,
          lastName: null,
          email: "dan@example.com",
          expected: "D",
        },
      ]

      testCases.forEach((testCase, index) => {
        const review = {
          ...mockReview,
          id: `review-${index}`,
          user: {
            id: `user-${index}`,
            username: testCase.username,
            firstName: testCase.firstName || null,
            lastName: testCase.lastName || null,
            email: testCase.email || "test@example.com",
          },
        }
        const { container, unmount } = render(<ReviewCard review={review} />)
        const avatar = container.querySelector(".text-noir-dark")
        expect(avatar).toHaveTextContent(testCase.expected)
        unmount()
      })
    })
  })

  describe("Date Formatting", () => {
    it("shows formatted distance for valid dates", () => {
      render(<ReviewCard review={mockReview} />)
      expect(screen.getByText("5 days ago")).toBeInTheDocument()
    })

    it('shows "Recently" for invalid dates', () => {
      const reviewWithInvalidDate = {
        ...mockReview,
        createdAt: "invalid-date",
      }
      render(<ReviewCard review={reviewWithInvalidDate} />)
      expect(screen.getByText("Recently")).toBeInTheDocument()
    })

    it("handles various date formats", () => {
      const testDates = [
        {
          date: new Date("2024-01-14T12:00:00Z").toISOString(),
          expected: "1 day ago",
        },
        {
          date: new Date("2024-01-15T12:00:00Z").toISOString(),
          expected: "today",
        },
      ]

      testDates.forEach((testCase, index) => {
        const review = {
          ...mockReview,
          id: `review-${index}`,
          createdAt: testCase.date,
        }
        const { unmount } = render(<ReviewCard review={review} />)
        expect(screen.getByText(testCase.expected)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("Owner Actions", () => {
    it("shows edit button when user is the owner", () => {
      const onEdit = vi.fn()
      render(<ReviewCard review={mockReview} currentUserId="user-1" onEdit={onEdit} />)
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    })

    it("shows delete button when user is the owner", () => {
      const onDelete = vi.fn()
      render(<ReviewCard review={mockReview} currentUserId="user-1" onDelete={onDelete} />)
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
    })

    it("calls onEdit with review id when edit is clicked", async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      render(<ReviewCard review={mockReview} currentUserId="user-1" onEdit={onEdit} />)

      const editButton = screen.getByRole("button", { name: /edit/i })
      // Use fireEvent for immediate execution instead of userEvent
      editButton.click()

      expect(onEdit).toHaveBeenCalledWith("review-1")
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it("calls onDelete with review id when delete is clicked", async () => {
      const onDelete = vi.fn()
      render(<ReviewCard review={mockReview} currentUserId="user-1" onDelete={onDelete} />)

      const deleteButton = screen.getByRole("button", { name: /delete/i })
      deleteButton.click()

      // Modal opens; confirm delete via DangerModal "Remove" button
      const removeButton = await screen.findByRole("button", { name: /remove/i })
      removeButton.click()

      expect(onDelete).toHaveBeenCalledWith("review-1")
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it("does not show edit button when user is not the owner", () => {
      const onEdit = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserId="different-user"
          onEdit={onEdit}
        />)
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
    })

    it("does not show action buttons when callbacks are not provided", () => {
      render(<ReviewCard review={mockReview} currentUserId="user-1" />)
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
    })
  })

  describe("Admin/Editor Actions", () => {
    it("shows delete button for admin users even if not owner", () => {
      const onDelete = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserId="admin-user"
          currentUserRole="admin"
          onDelete={onDelete}
        />)
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
    })

    it("shows delete button for editor users even if not owner", () => {
      const onDelete = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserId="editor-user"
          currentUserRole="editor"
          onDelete={onDelete}
        />)
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
    })

    it("does not show edit button for moderators who are not owners", () => {
      const onEdit = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserId="admin-user"
          currentUserRole="admin"
          onEdit={onEdit}
        />)
      // Edit button should not appear for non-owners
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe("Moderation Actions", () => {
    it("shows moderation actions when showModerationActions is true and user is admin", () => {
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="admin"
          onModerate={onModerate}
          showModerationActions={true}
        />)

      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
    })

    it("shows moderation actions when showModerationActions is true and user is editor", () => {
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="editor"
          onModerate={onModerate}
          showModerationActions={true}
        />)

      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
    })

    it("does not show moderation actions when user is not admin or editor", () => {
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="user"
          onModerate={onModerate}
          showModerationActions={true}
        />)

      expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument()
    })

    it("does not show moderation actions when showModerationActions is false", () => {
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="admin"
          onModerate={onModerate}
          showModerationActions={false}
        />)

      expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument()
    })

    it("calls onModerate with true when approve is clicked", async () => {
      const user = userEvent.setup()
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="admin"
          onModerate={onModerate}
          showModerationActions={true}
        />)

      const approveButton = screen.getByRole("button", { name: /approve/i })
      // Use fireEvent for immediate execution instead of userEvent
      approveButton.click()

      expect(onModerate).toHaveBeenCalledWith("review-1", true)
      expect(onModerate).toHaveBeenCalledTimes(1)
    })

    it("calls onModerate with false when reject is clicked", async () => {
      const user = userEvent.setup()
      const onModerate = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserRole="admin"
          onModerate={onModerate}
          showModerationActions={true}
        />)

      const rejectButton = screen.getByRole("button", { name: /reject/i })
      // Use fireEvent for immediate execution instead of userEvent
      rejectButton.click()

      expect(onModerate).toHaveBeenCalledWith("review-1", false)
      expect(onModerate).toHaveBeenCalledTimes(1)
    })
  })

  describe("Moderation Status Display", () => {
    it("shows approved status when review is approved and showModerationActions is true", () => {
      const approvedReview = { ...mockReview, isApproved: true }
      render(<ReviewCard review={approvedReview} showModerationActions={true} />)

      expect(screen.getByText(/✓ Approved/)).toBeInTheDocument()
    })

    it("shows pending status when review is not approved and showModerationActions is true", () => {
      render(<ReviewCard review={mockReview} showModerationActions={true} />)

      expect(screen.getByText(/⏳ Pending Review/)).toBeInTheDocument()
    })

    it("does not show status when showModerationActions is false", () => {
      render(<ReviewCard review={mockReview} showModerationActions={false} />)

      expect(screen.queryByText(/Status:/)).not.toBeInTheDocument()
    })
  })

  describe("HTML Content Rendering", () => {
    it("renders HTML content using dangerouslySetInnerHTML", () => {
      const htmlReview = {
        ...mockReview,
        review: "<p>This has <strong>bold</strong> text</p>",
      }
      render(<ReviewCard review={htmlReview} />)

      const strongElement = screen.getByText("bold")
      expect(strongElement.tagName).toBe("STRONG")
    })

    it("renders complex HTML structures", () => {
      const complexReview = {
        ...mockReview,
        review: "<div><h3>Great!</h3><ul><li>Item 1</li><li>Item 2</li></ul></div>",
      }
      const { container } = render(<ReviewCard review={complexReview} />)

      expect(container.querySelector("h3")).toBeInTheDocument()
      expect(container.querySelector("ul")).toBeInTheDocument()
      expect(container.querySelectorAll("li").length).toBe(2)
    })
  })

  describe("Accessibility", () => {
    it("has proper button roles for action buttons", () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      render(<ReviewCard
          review={mockReview}
          currentUserId="user-1"
          onEdit={onEdit}
          onDelete={onDelete}
        />)

      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
    })

    it("has semantic HTML structure", () => {
      const { container } = render(<ReviewCard review={mockReview} />)

      // Should have proper div structure
      expect(container.querySelector(".space-y-3")).toBeInTheDocument()
    })

    it("has accessible avatar with text", () => {
      render(<ReviewCard review={mockReview} />)
      const avatar = screen.getByText("T")
      expect(avatar).toHaveClass("text-noir-dark")
    })
  })

  describe("Edge Cases", () => {
    it("handles missing optional props gracefully", () => {
      expect(() => render(<ReviewCard review={mockReview} />)).not.toThrow()
    })

    it("handles all callbacks being undefined", () => {
      render(<ReviewCard review={mockReview} currentUserId="user-1" />)
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("handles empty review content", () => {
      const emptyReview = { ...mockReview, review: "" }
      const { container } = render(<ReviewCard review={emptyReview} />)
      expect(container).toBeInTheDocument()
    })

    it("handles very long usernames", () => {
      const longUsernameReview = {
        ...mockReview,
        user: {
          ...mockReview.user,
          username: "verylongusernamethatmightbreakthelayout1234567890",
        },
      }
      render(<ReviewCard review={longUsernameReview} />)
      expect(screen.getByText("verylongusernamethatmightbreakthelayout1234567890")).toBeInTheDocument()
    })

    it("handles special characters in display names", () => {
      const specialCharReview = {
        ...mockReview,
        user: {
          ...mockReview.user,
          username: "user@#$%^&*()",
        },
      }
      render(<ReviewCard review={specialCharReview} />)
      expect(screen.getByText("user@#$%^&*()")).toBeInTheDocument()
    })
  })

  describe("Style Classes", () => {
    it("applies correct text colors to status indicators", () => {
      const approvedReview = { ...mockReview, isApproved: true }
      const { container } = render(<ReviewCard review={approvedReview} showModerationActions={true} />)

      const approvedStatus = screen.getByText(/✓ Approved/)
      expect(approvedStatus).toHaveClass("text-green-600")
    })

    it("applies correct hover effects to buttons", () => {
      const onDelete = vi.fn()
      render(<ReviewCard review={mockReview} currentUserId="user-1" onDelete={onDelete} />)

      const deleteButton = screen.getByRole("button", { name: /delete/i })
      // Button component with background="red" applies hover:bg-red-700
      expect(deleteButton).toHaveClass("hover:bg-red-700")
    })

    it("uses prose styling for review content", () => {
      const { container } = render(<ReviewCard review={mockReview} />)
      const proseElement = container.querySelector(".prose")
      expect(proseElement).toBeInTheDocument()
      expect(proseElement).toHaveClass("prose-sm")
      expect(proseElement).toHaveClass("text-noir-light")
    })
  })
})
