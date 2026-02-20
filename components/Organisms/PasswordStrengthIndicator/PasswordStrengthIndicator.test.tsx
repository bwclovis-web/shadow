import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import PasswordStrengthIndicator from "./PasswordStrengthIndicator"

// Mock the usePasswordStrength hook
vi.mock("~/hooks", () => ({
  usePasswordStrength: vi.fn(),
}))

import { usePasswordStrength } from "~/hooks"

const mockUsePasswordStrength = usePasswordStrength as ReturnType<typeof vi.fn>

describe("PasswordStrengthIndicator", () => {
  const defaultMockReturn = {
    strengthInfo: {
      score: 4,
      strength: "good",
      feedback: [],
    },
    isValid: false,
    getStrengthColor: vi.fn(() => "bg-yellow-500"),
    getStrengthText: vi.fn(() => "Good"),
  }

  beforeEach(() => {
    mockUsePasswordStrength.mockReturnValue(defaultMockReturn)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders password strength indicator with strength bar", () => {
      const { container } = render(<PasswordStrengthIndicator password="Password123!" />)

      expect(container.querySelector(".bg-gray-200")).toBeInTheDocument()
      expect(container.querySelector(".h-2.rounded-full")).toBeInTheDocument()
    })

    it("renders strength text", () => {
      render(<PasswordStrengthIndicator password="Password123!" />)
      expect(screen.getByText("Good")).toBeInTheDocument()
    })

    it("returns null when password is empty", () => {
      const { container } = render(<PasswordStrengthIndicator password="" />)
      expect(container.firstChild).toBeNull()
    })

    it("returns null when strengthInfo is null", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: null,
      })

      const { container } = render(<PasswordStrengthIndicator password="test" />)
      expect(container.firstChild).toBeNull()
    })

    it("applies custom className", () => {
      const { container } = render(<PasswordStrengthIndicator
          password="Password123!"
          className="custom-class"
        />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("Strength Levels", () => {
    it("displays weak password with red alert icon", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 1, strength: "weak", feedback: ["Too short"] },
        getStrengthColor: vi.fn(() => "bg-red-500"),
        getStrengthText: vi.fn(() => "Weak"),
      })

      const { container } = render(<PasswordStrengthIndicator password="weak" />)

      expect(screen.getByText("Weak")).toBeInTheDocument()
      const icon = container.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("displays fair password with orange badge icon", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 2, strength: "fair", feedback: [] },
        getStrengthColor: vi.fn(() => "bg-orange-500"),
        getStrengthText: vi.fn(() => "Fair"),
      })

      render(<PasswordStrengthIndicator password="Fair123" />)
      expect(screen.getByText("Fair")).toBeInTheDocument()
    })

    it("displays good password with yellow badge icon", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 4, strength: "good", feedback: [] },
        getStrengthColor: vi.fn(() => "bg-yellow-500"),
        getStrengthText: vi.fn(() => "Good"),
      })

      render(<PasswordStrengthIndicator password="Good123!" />)
      expect(screen.getByText("Good")).toBeInTheDocument()
    })

    it("displays strong password with blue check icon", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 6, strength: "strong", feedback: [] },
        getStrengthColor: vi.fn(() => "bg-blue-500"),
        getStrengthText: vi.fn(() => "Strong"),
      })

      render(<PasswordStrengthIndicator password="Strong123!@#" />)
      expect(screen.getByText("Strong")).toBeInTheDocument()
    })

    it("displays very strong password with green check icon", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 8, strength: "very_strong", feedback: [] },
        getStrengthColor: vi.fn(() => "bg-green-500"),
        getStrengthText: vi.fn(() => "Very Strong"),
        isValid: true,
      })

      render(<PasswordStrengthIndicator password="VeryStrong123!@#$" />)
      expect(screen.getByText("Very Strong")).toBeInTheDocument()
      expect(screen.getByText("Excellent password strength!")).toBeInTheDocument()
    })
  })

  describe("Strength Bar Width", () => {
    it("calculates correct width based on score", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 4, strength: "good", feedback: [] },
      })

      const { container } = render(<PasswordStrengthIndicator password="test" />)

      const strengthBar = container.querySelector(".transition-all")
      expect(strengthBar).toHaveStyle({ width: "50%" }) // (4/8) * 100%
    })

    it("caps width at 100% for high scores", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 10, strength: "very_strong", feedback: [] },
      })

      const { container } = render(<PasswordStrengthIndicator password="test" />)

      const strengthBar = container.querySelector(".transition-all")
      expect(strengthBar).toHaveStyle({ width: "100%" })
    })

    it("shows minimal width for very weak passwords", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 0, strength: "weak", feedback: ["Too short"] },
      })

      const { container } = render(<PasswordStrengthIndicator password="a" />)

      const strengthBar = container.querySelector(".transition-all")
      expect(strengthBar).toHaveStyle({ width: "0%" })
    })
  })

  describe("Feedback Messages", () => {
    it("displays feedback messages when provided", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 2,
          strength: "weak",
          feedback: [
            "Password is too short",
            "Add uppercase letters",
            "Add special characters",
          ],
        },
      })

      render(<PasswordStrengthIndicator password="short" />)

      expect(screen.getByText("Password is too short")).toBeInTheDocument()
      expect(screen.getByText("Add uppercase letters")).toBeInTheDocument()
      expect(screen.getByText("Add special characters")).toBeInTheDocument()
    })

    it("does not display feedback section when no feedback", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 8, strength: "very_strong", feedback: [] },
      })

      const { container } = render(<PasswordStrengthIndicator password="VeryStrong123!@#" />)

      expect(container.querySelector(".space-y-1")).not.toBeInTheDocument()
    })

    it("renders each feedback item with bullet point", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 2,
          strength: "weak",
          feedback: ["Need more length", "Add numbers"],
        },
      })

      const { container } = render(<PasswordStrengthIndicator password="weak" />)

      const bullets = container.querySelectorAll(".text-red-500")
      expect(bullets.length).toBe(2)
    })
  })

  describe("Validation Status", () => {
    it("shows validation success message when password is valid", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 6, strength: "strong", feedback: [] },
        isValid: true,
      })

      render(<PasswordStrengthIndicator password="Valid123!@#" />)
      expect(screen.getByText("Password meets all requirements")).toBeInTheDocument()
    })

    it("does not show validation message when password is invalid", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 2, strength: "weak", feedback: ["Too short"] },
        isValid: false,
      })

      render(<PasswordStrengthIndicator password="weak" />)
      expect(screen.queryByText("Password meets all requirements")).not.toBeInTheDocument()
    })

    it("shows both excellence and validation messages for very strong valid passwords", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 8, strength: "very_strong", feedback: [] },
        isValid: true,
      })

      render(<PasswordStrengthIndicator password="Excellent123!@#$" />)

      expect(screen.getByText("Excellent password strength!")).toBeInTheDocument()
      expect(screen.getByText("Password meets all requirements")).toBeInTheDocument()
    })
  })

  describe("Custom Configuration", () => {
    it("passes custom minLength to hook", () => {
      render(<PasswordStrengthIndicator password="test" minLength={12} />)

      expect(mockUsePasswordStrength).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          minLength: 12,
        })
      )
    })

    it("passes custom requirement flags to hook", () => {
      render(<PasswordStrengthIndicator
          password="test"
          requireUppercase={false}
          requireLowercase={true}
          requireNumbers={false}
          requireSpecialChars={true}
        />)

      expect(mockUsePasswordStrength).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          requireUppercase: false,
          requireLowercase: true,
          requireNumbers: false,
          requireSpecialChars: true,
        })
      )
    })

    it("passes custom minScore to hook", () => {
      render(<PasswordStrengthIndicator password="test" minScore={5} />)

      expect(mockUsePasswordStrength).toHaveBeenCalledWith(
        "test",
        expect.objectContaining({
          minScore: 5,
        })
      )
    })

    it("uses default values when no custom config provided", () => {
      render(<PasswordStrengthIndicator password="test" />)

      expect(mockUsePasswordStrength).toHaveBeenCalledWith("test", {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        minScore: 3,
      })
    })
  })

  describe("Visual Styling", () => {
    it("applies correct color classes from hook", () => {
      const mockGetStrengthColor = vi.fn(() => "bg-green-500")
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        getStrengthColor: mockGetStrengthColor,
      })

      const { container } = render(<PasswordStrengthIndicator password="test" />)

      expect(mockGetStrengthColor).toHaveBeenCalledWith("good")
      const strengthBar = container.querySelector(".bg-green-500")
      expect(strengthBar).toBeInTheDocument()
    })

    it("applies transition classes to strength bar", () => {
      const { container } = render(<PasswordStrengthIndicator password="test" />)

      const strengthBar = container.querySelector(".transition-all")
      expect(strengthBar).toHaveClass("duration-300")
    })

    it("uses space-y-2 for component spacing", () => {
      const { container } = render(<PasswordStrengthIndicator password="test" />)

      expect(container.firstChild).toHaveClass("space-y-2")
    })
  })

  describe("Icon Rendering", () => {
    it("renders alert icon for weak passwords", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 1, strength: "weak", feedback: [] },
        getStrengthText: vi.fn(() => "Weak"),
      })

      const { container } = render(<PasswordStrengthIndicator password="weak" />)

      const icon = container.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("renders check icon for strong passwords", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 6, strength: "strong", feedback: [] },
        getStrengthText: vi.fn(() => "Strong"),
      })

      const { container } = render(<PasswordStrengthIndicator password="Strong123!" />)

      const icon = container.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("renders default icon for unknown strength", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 0, strength: "unknown" as any, feedback: [] },
        getStrengthText: vi.fn(() => "Unknown"),
      })

      const { container } = render(<PasswordStrengthIndicator password="???" />)

      const icon = container.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("handles empty feedback array", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: { score: 8, strength: "very_strong", feedback: [] },
      })

      expect(() => render(<PasswordStrengthIndicator password="test" />)).not.toThrow()
    })

    it("handles very long feedback messages", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 2,
          strength: "weak",
          feedback: ["This is a very long feedback message that should still render correctly even though it contains a lot of text",],
        },
      })

      render(<PasswordStrengthIndicator password="weak" />)
      expect(screen.getByText(/very long feedback message/)).toBeInTheDocument()
    })

    it("handles multiple feedback items correctly", () => {
      const feedbackItems = Array.from({ length: 10 }, (_, i) => `Feedback ${i + 1}`)

      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 1,
          strength: "weak",
          feedback: feedbackItems,
        },
      })

      render(<PasswordStrengthIndicator password="weak" />)

      feedbackItems.forEach(item => {
        expect(screen.getByText(item)).toBeInTheDocument()
      })
    })

    it("handles special characters in feedback", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 2,
          strength: "weak",
          feedback: ["Use special chars like !@#$%^&*()"],
        },
      })

      render(<PasswordStrengthIndicator password="test" />)
      expect(screen.getByText(/!@#\$%\^&\*/)).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("uses semantic HTML structure", () => {
      const { container } = render(<PasswordStrengthIndicator password="test" />)

      expect(container.querySelector("div")).toBeInTheDocument()
    })

    it("provides visual indicators with icons and text", () => {
      render(<PasswordStrengthIndicator password="Good123!" />)

      const strengthText = screen.getByText("Good")
      expect(strengthText).toBeInTheDocument()
    })

    it("uses contrasting colors for feedback", () => {
      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        strengthInfo: {
          score: 2,
          strength: "weak",
          feedback: ["Needs improvement"],
        },
      })

      const { container } = render(<PasswordStrengthIndicator password="weak" />)

      const bullet = container.querySelector(".text-red-500")
      expect(bullet).toBeInTheDocument()
    })
  })

  describe("Integration with Hook", () => {
    it("calls usePasswordStrength with correct password", () => {
      const password = "TestPassword123!"
      render(<PasswordStrengthIndicator password={password} />)

      expect(mockUsePasswordStrength).toHaveBeenCalledWith(
        password,
        expect.any(Object)
      )
    })

    it("updates when password changes", () => {
      const { rerender } = render(<PasswordStrengthIndicator password="weak" />)

      rerender(<PasswordStrengthIndicator password="StrongPassword123!" />)

      expect(mockUsePasswordStrength).toHaveBeenCalledTimes(2)
      expect(mockUsePasswordStrength).toHaveBeenLastCalledWith(
        "StrongPassword123!",
        expect.any(Object)
      )
    })

    it("uses all helper functions from hook", () => {
      const mockGetStrengthColor = vi.fn(() => "bg-blue-500")
      const mockGetStrengthText = vi.fn(() => "Strong")

      mockUsePasswordStrength.mockReturnValue({
        ...defaultMockReturn,
        getStrengthColor: mockGetStrengthColor,
        getStrengthText: mockGetStrengthText,
      })

      render(<PasswordStrengthIndicator password="test" />)

      expect(mockGetStrengthColor).toHaveBeenCalled()
      expect(mockGetStrengthText).toHaveBeenCalled()
    })
  })
})
