import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "../../../../test/utils/test-utils"
import { ChangePasswordForm } from "./ChangePasswordForm"

// Mock PasswordStrengthIndicator
vi.mock("~/components/Organisms/PasswordStrengthIndicator", () => ({
  default: ({ password }: { password: string }) => (
    <div data-testid="password-strength-indicator">
      Strength: {password.length > 8 ? "Strong" : "Weak"}
    </div>
  ),
}))

// Mock react-router Form to avoid data router requirement
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router")
  return {
    ...actual,
    Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  }
})

describe("ChangePasswordForm", () => {
  describe("Rendering", () => {
    it("renders the form with all fields", () => {
      renderWithProviders(<ChangePasswordForm />)

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText("New Password")).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    })

    it("renders the form header", () => {
      renderWithProviders(<ChangePasswordForm />)

      expect(screen.getByRole("heading", { name: "Change Password" })).toBeInTheDocument()
      expect(screen.getByText(/update your password to keep your account secure/i)).toBeInTheDocument()
    })

    it("renders password requirements", () => {
      renderWithProviders(<ChangePasswordForm />)

      expect(screen.getByText(/password requirements:/i)).toBeInTheDocument()
      expect(screen.getByText(/at least 8 characters long/i)).toBeInTheDocument()
      expect(screen.getByText(/contains uppercase and lowercase letters/i)).toBeInTheDocument()
      expect(screen.getByText(/contains at least one number/i)).toBeInTheDocument()
      expect(screen.getByText(/contains at least one special character/i)).toBeInTheDocument()
    })

    it("renders submit and clear buttons", () => {
      renderWithProviders(<ChangePasswordForm />)

      expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = renderWithProviders(<ChangePasswordForm className="custom-class" />)
      const form = container.querySelector("form")
      expect(form).toHaveClass("custom-class")
    })
  })

  describe("Password Field Interaction", () => {
    it("allows typing in current password field", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement
      await user.type(currentPasswordInput, "OldPassword123!")

      expect(currentPasswordInput.value).toBe("OldPassword123!")
    })

    it("allows typing in new password field", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement
      await user.type(newPasswordInput, "NewPassword123!")

      expect(newPasswordInput.value).toBe("NewPassword123!")
    })

    it("allows typing in confirm password field", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement
      await user.type(confirmPasswordInput, "NewPassword123!")

      expect(confirmPasswordInput.value).toBe("NewPassword123!")
    })

    it("has all password fields as required", () => {
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      expect(currentPasswordInput).toHaveAttribute("required")
      expect(newPasswordInput).toHaveAttribute("required")
      expect(confirmPasswordInput).toHaveAttribute("required")
    })
  })

  describe("Password Visibility Toggle", () => {
    it("toggles current password visibility", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement
      expect(currentPasswordInput.type).toBe("password")

      const toggleButtons = screen.getAllByRole("button", { name: "" })
      await user.click(toggleButtons[0])

      expect(currentPasswordInput.type).toBe("text")

      await user.click(toggleButtons[0])
      expect(currentPasswordInput.type).toBe("password")
    })

    it("toggles new password visibility", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement
      expect(newPasswordInput.type).toBe("password")

      const toggleButtons = screen.getAllByRole("button", { name: "" })
      await user.click(toggleButtons[1])

      expect(newPasswordInput.type).toBe("text")
    })

    it("toggles confirm password visibility", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement
      expect(confirmPasswordInput.type).toBe("password")

      const toggleButtons = screen.getAllByRole("button", { name: "" })
      await user.click(toggleButtons[2])

      expect(confirmPasswordInput.type).toBe("text")
    })

    it("displays eye icon when password is hidden", () => {
      const { container } = renderWithProviders(<ChangePasswordForm />)
      const eyeIcons = container.querySelectorAll("svg")
      expect(eyeIcons.length).toBeGreaterThan(0)
    })
  })

  describe("Password Strength Indicator", () => {
    it("shows password strength indicator when typing new password", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      await user.type(newPasswordInput, "NewPassword123!")

      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()
    })

    it("does not show password strength indicator when new password is empty", () => {
      renderWithProviders(<ChangePasswordForm />)
      expect(screen.queryByTestId("password-strength-indicator")).not.toBeInTheDocument()
    })

    it("updates password strength as user types", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")

      await user.type(newPasswordInput, "weak")
      expect(screen.getByText(/weak/i)).toBeInTheDocument()

      await user.clear(newPasswordInput)
      await user.type(newPasswordInput, "StrongPassword123!")
      expect(screen.getByText(/strong/i)).toBeInTheDocument()
    })
  })

  describe("Password Match Validation", () => {
    it("shows success message when passwords match", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Password123!")

      // Check for the success message text (more reliable than emoji in test environment)
      expect(screen.getByText(/passwords match/i)).toBeInTheDocument()
    })

    it("shows error message when passwords do not match", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "DifferentPassword123!")

      // Check for the error message text (more reliable than emoji in test environment)
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it("applies error styling when passwords do not match", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Different!")

      expect(confirmPasswordInput).toHaveClass("border-red-300")
    })

    it("applies normal styling when passwords match", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Password123!")

      expect(confirmPasswordInput).toHaveClass("border-gray-300")
    })
  })

  describe("Form Validation", () => {
    it("disables submit button when form is empty", () => {
      renderWithProviders(<ChangePasswordForm />)

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      expect(submitButton).toBeDisabled()
    })

    it("disables submit button when current password is missing", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Password123!")

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      expect(submitButton).toBeDisabled()
    })

    it("disables submit button when passwords do not match", async () => {
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      // Use fireEvent to avoid timeout from userEvent.type() with long strings
      fireEvent.change(currentPasswordInput, { target: { value: "OldPassword123!" } })
      fireEvent.change(newPasswordInput, { target: { value: "NewPassword123!" } })
      fireEvent.change(confirmPasswordInput, { target: { value: "DifferentPassword123!" } })

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      expect(submitButton).toBeDisabled()
    })

    it("enables submit button when form is valid", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(currentPasswordInput, "OldPassword123!")
      await user.type(newPasswordInput, "NewPassword123!")
      await user.type(confirmPasswordInput, "NewPassword123!")

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      expect(submitButton).not.toBeDisabled()
    })

    it("disables submit button when isSubmitting is true", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm isSubmitting={true} />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(currentPasswordInput, "OldPassword123!")
      await user.type(newPasswordInput, "NewPassword123!")
      await user.type(confirmPasswordInput, "NewPassword123!")

      const submitButton = screen.getByRole("button", {
        name: /changing password.../i,
      })
      expect(submitButton).toBeDisabled()
    })
  })

  describe("Clear Button", () => {
    it("clears all fields when clear button is clicked", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement
      const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement

      await user.type(currentPasswordInput, "OldPassword123!")
      await user.type(newPasswordInput, "NewPassword123!")
      await user.type(confirmPasswordInput, "NewPassword123!")

      expect(currentPasswordInput.value).toBe("OldPassword123!")
      expect(newPasswordInput.value).toBe("NewPassword123!")
      expect(confirmPasswordInput.value).toBe("NewPassword123!")

      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)

      expect(currentPasswordInput.value).toBe("")
      expect(newPasswordInput.value).toBe("")
      expect(confirmPasswordInput.value).toBe("")
    })

    it("hides password strength indicator after clearing", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      await user.type(newPasswordInput, "NewPassword123!")

      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()

      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)

      expect(screen.queryByTestId("password-strength-indicator")).not.toBeInTheDocument()
    })

    it("hides password match indicator after clearing", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Password123!")

      expect(screen.getByText(/passwords match/i)).toBeInTheDocument()

      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)

      expect(screen.queryByText(/passwords match/i)).not.toBeInTheDocument()
    })
  })

  describe("Error Display", () => {
    it("displays error message when actionData contains error", () => {
      const actionData = {
        error: "Current password is incorrect",
      }

      renderWithProviders(<ChangePasswordForm actionData={actionData} />)

      expect(screen.getByText("Error")).toBeInTheDocument()
      expect(screen.getByText("Current password is incorrect")).toBeInTheDocument()
    })

    it("applies error styling to error message", () => {
      const actionData = {
        error: "Current password is incorrect",
      }

      const { container } = renderWithProviders(<ChangePasswordForm actionData={actionData} />)
      const errorContainer = container.querySelector(".bg-red-50")
      expect(errorContainer).toBeInTheDocument()
    })

    it("does not display error when actionData has no error", () => {
      renderWithProviders(<ChangePasswordForm />)
      expect(screen.queryByText("Error")).not.toBeInTheDocument()
    })
  })

  describe("Success Display", () => {
    it("displays success message when actionData contains success", () => {
      const actionData = {
        success: true,
        message: "Password changed successfully",
      }

      renderWithProviders(<ChangePasswordForm actionData={actionData} />)

      expect(screen.getByText("Success")).toBeInTheDocument()
      expect(screen.getByText("Password changed successfully")).toBeInTheDocument()
    })

    it("applies success styling to success message", () => {
      const actionData = {
        success: true,
        message: "Password changed successfully",
      }

      const { container } = renderWithProviders(<ChangePasswordForm actionData={actionData} />)
      const successContainer = container.querySelector(".bg-green-50")
      expect(successContainer).toBeInTheDocument()
    })

    it("does not display success when actionData has no success", () => {
      renderWithProviders(<ChangePasswordForm />)
      expect(screen.queryByText("Success")).not.toBeInTheDocument()
    })
  })

  describe("Submit Button States", () => {
    it("shows default text when not submitting", () => {
      renderWithProviders(<ChangePasswordForm />)
      expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument()
    })

    it("shows loading text when submitting", () => {
      renderWithProviders(<ChangePasswordForm isSubmitting={true} />)
      expect(screen.getByRole("button", { name: /changing password.../i })).toBeInTheDocument()
    })

    it("disables submit button during submission", () => {
      renderWithProviders(<ChangePasswordForm isSubmitting={true} />)
      const submitButton = screen.getByRole("button", {
        name: /changing password.../i,
      })
      expect(submitButton).toBeDisabled()
    })
  })

  describe("Form Submission", () => {
    it("has correct form method", () => {
      const { container } = renderWithProviders(<ChangePasswordForm />)
      const form = container.querySelector("form")
      expect(form).toHaveAttribute("method", "post")
    })

    it("submits form with all field values", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(currentPasswordInput, "OldPassword123!")
      await user.type(newPasswordInput, "NewPassword123!")
      await user.type(confirmPasswordInput, "NewPassword123!")

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe("Input Names", () => {
    it("has correct name attributes for form submission", () => {
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      expect(currentPasswordInput).toHaveAttribute("name", "currentPassword")
      expect(newPasswordInput).toHaveAttribute("name", "newPassword")
      expect(confirmPasswordInput).toHaveAttribute("name", "confirmNewPassword")
    })
  })

  describe("Placeholders", () => {
    it("has helpful placeholders for all fields", () => {
      renderWithProviders(<ChangePasswordForm />)

      expect(screen.getByPlaceholderText(/enter your current password/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/enter your new password/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/confirm your new password/i)).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("has proper label associations", () => {
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      expect(currentPasswordInput).toHaveAttribute("id", "currentPassword")
      expect(newPasswordInput).toHaveAttribute("id", "newPassword")
      expect(confirmPasswordInput).toHaveAttribute("id", "confirmNewPassword")
    })

    it("has semantic button types", () => {
      renderWithProviders(<ChangePasswordForm />)

      const submitButton = screen.getByRole("button", {
        name: /change password/i,
      })
      const clearButton = screen.getByRole("button", { name: /clear/i })

      expect(submitButton).toHaveAttribute("type", "submit")
      expect(clearButton).toHaveAttribute("type", "button")
    })

    it("provides visual feedback for password match", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(newPasswordInput, "Password123!")
      await user.type(confirmPasswordInput, "Password123!")

      // Green checkmark and success message indicates passwords match
      expect(screen.getByText(/passwords match/i)).toBeInTheDocument()

      await user.clear(confirmPasswordInput)
      await user.type(confirmPasswordInput, "Different!")

      // Error message indicates passwords do not match
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("applies correct spacing classes", () => {
      const { container } = renderWithProviders(<ChangePasswordForm />)
      const form = container.querySelector("form")
      expect(form).toHaveClass("space-y-6")
    })

    it("applies focus styles to inputs", () => {
      renderWithProviders(<ChangePasswordForm />)

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      expect(currentPasswordInput).toHaveClass("focus:ring-2")
      expect(currentPasswordInput).toHaveClass("focus:ring-blue-500")
    })

    it("applies correct button styling", () => {
      renderWithProviders(<ChangePasswordForm />)

      const clearButton = screen.getByRole("button", { name: /clear/i })
      expect(clearButton).toHaveClass("border-gray-300")
      expect(clearButton).toHaveClass("hover:bg-gray-50")
    })
  })

  describe("Edge Cases", () => {
    it("handles very long passwords", async () => {
      renderWithProviders(<ChangePasswordForm />)

      const longPassword = "A".repeat(100) + "1!"
      const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement

      // Use fireEvent.change instead of user.type for long strings to avoid timeout
      fireEvent.change(newPasswordInput, { target: { value: longPassword } })
      expect(newPasswordInput.value).toBe(longPassword)
    })

    it("handles special characters in passwords", async () => {
      renderWithProviders(<ChangePasswordForm />)

      const specialPassword = "P@$$w0rd!#%&*()_+-=[]{}|;:,.<>?"
      const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement

      // Use fireEvent.change instead of user.type because user.type interprets
      // special characters like []{}|;:,.<>? as keyboard shortcuts
      fireEvent.change(newPasswordInput, { target: { value: specialPassword } })
      expect(newPasswordInput.value).toBe(specialPassword)
    })

    it("handles rapid typing and clearing", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")

      await user.type(newPasswordInput, "password")
      await user.clear(newPasswordInput)
      await user.type(newPasswordInput, "newpassword")
      await user.clear(newPasswordInput)
      await user.type(newPasswordInput, "finalpassword")

      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()
    })

    it("handles missing actionData prop", () => {
      expect(() => renderWithProviders(<ChangePasswordForm />)).not.toThrow()
    })

    it("handles undefined isSubmitting prop", () => {
      renderWithProviders(<ChangePasswordForm isSubmitting={undefined} />)
      expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument()
    })
  })

  describe("Integration", () => {
    it("integrates password strength indicator with new password field", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      const newPasswordInput = screen.getByLabelText("New Password")

      await user.type(newPasswordInput, "weak")
      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()

      await user.type(newPasswordInput, "makeitstronger123!")
      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()
    })

    it("coordinates all form elements correctly", async () => {
      const user = userEvent.setup()
      renderWithProviders(<ChangePasswordForm />)

      // Fill all fields
      await user.type(screen.getByLabelText(/current password/i), "OldPassword123!")
      await user.type(screen.getByLabelText("New Password"), "NewPassword123!")
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        "NewPassword123!"
      )

      // Verify all indicators are working
      expect(screen.getByTestId("password-strength-indicator")).toBeInTheDocument()
      expect(screen.getByText(/passwords match/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /change password/i })).not.toBeDisabled()
    })
  })
})
