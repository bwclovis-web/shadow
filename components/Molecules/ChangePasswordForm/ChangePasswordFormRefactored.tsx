import { useState } from "react"
import { Form } from "react-router"

import { Button } from "~/components/Atoms/Button"
import PasswordStrengthIndicator from "~/components/Organisms/PasswordStrengthIndicator"

import ErrorMessage from "./components/ErrorMessage"
import FormHeader from "./components/FormHeader"
import PasswordInput from "./components/PasswordInput"
import PasswordMatchIndicator from "./components/PasswordMatchIndicator"
import PasswordRequirements from "./components/PasswordRequirements"
import SuccessMessage from "./components/SuccessMessage"

interface ChangePasswordFormProps {
  actionData?: any
  isSubmitting?: boolean
  className?: string
}

export default function ChangePasswordForm({
  actionData,
  isSubmitting = false,
  className = "",
}: ChangePasswordFormProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const passwordsMatch = formData.newPassword === formData.confirmNewPassword
  const isFormValid =
    formData.currentPassword &&
    formData.newPassword &&
    formData.confirmNewPassword &&
    passwordsMatch

  return (
    <Form method="post" className={`space-y-6 ${className}`}>
      <FormHeader />

      {/* Current Password */}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Current Password
        </label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          value={formData.currentPassword}
          onChange={handleInputChange}
          placeholder="Enter your current password"
          showPassword={showPasswords.current}
          onToggleVisibility={() => togglePasswordVisibility("current")}
          required
        />
      </div>

      {/* New Password */}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          New Password
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleInputChange}
          placeholder="Enter your new password"
          showPassword={showPasswords.new}
          onToggleVisibility={() => togglePasswordVisibility("new")}
          required
        />

        {/* Password Strength Indicator */}
        {formData.newPassword && (
          <div className="mt-2">
            <PasswordStrengthIndicator password={formData.newPassword} />
          </div>
        )}
      </div>

      {/* Confirm New Password */}
      <div>
        <label
          htmlFor="confirmNewPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Confirm New Password
        </label>
        <PasswordInput
          id="confirmNewPassword"
          name="confirmNewPassword"
          value={formData.confirmNewPassword}
          onChange={handleInputChange}
          placeholder="Confirm your new password"
          showPassword={showPasswords.confirm}
          onToggleVisibility={() => togglePasswordVisibility("confirm")}
          hasError={formData.confirmNewPassword ? !passwordsMatch : false}
          required
        />

        <PasswordMatchIndicator
          confirmPassword={formData.confirmNewPassword}
          newPassword={formData.newPassword}
        />
      </div>

      {/* Error Messages */}
      {actionData?.error && <ErrorMessage message={actionData.error} />}

      {/* Success Messages */}
      {actionData?.success && <SuccessMessage message={actionData.message} />}

      {/* Password Requirements */}
      <PasswordRequirements />

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => setFormData({
              currentPassword: "",
              newPassword: "",
              confirmNewPassword: "",
            })
          }
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Clear
        </button>
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="px-6 py-2"
        >
          {isSubmitting ? "Changing Password..." : "Change Password"}
        </Button>
      </div>
    </Form>
  )
}
