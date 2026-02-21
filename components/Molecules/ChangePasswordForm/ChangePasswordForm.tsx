import { type ChangeEvent, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { BsFillEyeFill, BsFillEyeSlashFill } from "react-icons/bs"
import { Form } from "react-router"

import { Button } from "~/components/Atoms/Button"
import { CSRFToken } from "~/components/Molecules/CSRFToken"
import PasswordStrengthIndicator from "~/components/Organisms/PasswordStrengthIndicator"
import { authSchemas } from "~/utils/validation"

interface ChangePasswordFormProps {
  actionData?: any
  isSubmitting?: boolean
  className?: string
}

export const ChangePasswordForm = ({
  actionData,
  isSubmitting = false,
  className = "",
}: ChangePasswordFormProps) => {
  const t = useTranslations("password")
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Validate form on change
  useEffect(() => {
    const result = authSchemas.changePassword.safeParse(formData)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message
        }
      })
      setValidationErrors(errors)
    } else {
      setValidationErrors({})
    }
  }, [formData])

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const passwordsMatch = formData.newPassword === formData.confirmNewPassword
  const isFormValid =
    Object.keys(validationErrors).length === 0 &&
    formData.currentPassword &&
    formData.newPassword &&
    formData.confirmNewPassword

  return (
    <Form method="post" className={`space-y-6 ${className}`}>
      <CSRFToken />
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("changePassword")}</h2>
        <p className="text-gray-600">
          {t("updatePasswordToKeepAccountSecure")}
        </p>
      </div>

      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {t("currentPassword")}
        </label>
        <div className="relative">
          <input
            type={showPasswords.current ? "text" : "password"}
            id="currentPassword"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.currentPassword ? "border-red-300" : "border-gray-300"
            }`}
            placeholder={t("enterCurrentPassword")}
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility("current")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPasswords.current ? <BsFillEyeSlashFill /> : <BsFillEyeFill />}
          </button>
        </div>
        {validationErrors.currentPassword && (
          <p className="mt-1 text-sm text-red-600">
            {validationErrors.currentPassword}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {t("newPassword")}
        </label>
        <div className="relative">
          <input
            type={showPasswords.new ? "text" : "password"}
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.newPassword ? "border-red-300" : "border-gray-300"
            }`}
            placeholder={t("enterNewPassword")}
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility("new")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPasswords.new ? <BsFillEyeSlashFill /> : <BsFillEyeFill />}
          </button>
        </div>

        {validationErrors.newPassword && (
          <p className="mt-1 text-sm text-red-600">{validationErrors.newPassword}</p>
        )}

        {formData.newPassword && (
          <div className="mt-2">
            <PasswordStrengthIndicator password={formData.newPassword} />
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmNewPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {t("confirmNewPassword")}
        </label>
        <div className="relative">
          <input
            type={showPasswords.confirm ? "text" : "password"}
            id="confirmNewPassword"
            name="confirmNewPassword"
            value={formData.confirmNewPassword}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.confirmNewPassword ||
              (formData.confirmNewPassword && !passwordsMatch)
                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                : "border-gray-300"
            }`}
            placeholder={t("confirmNewPasswordPlaceholder")}
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility("confirm")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPasswords.confirm ? <BsFillEyeSlashFill /> : <BsFillEyeFill />}
          </button>
        </div>

        {validationErrors.confirmNewPassword && (
          <p className="mt-1 text-sm text-red-600">
            {validationErrors.confirmNewPassword}
          </p>
        )}

        {formData.confirmNewPassword && !validationErrors.confirmNewPassword && (
          <div className="mt-1 text-sm">
            {passwordsMatch ? (
              <span className="text-green-600 flex items-center space-x-1">
                <span>✅</span>
                <span>{t("passwordsMatch")}</span>
              </span>
            ) : (
              <span className="text-red-600 flex items-center space-x-1">
                <span>❌</span>
                <span>{t("passwordsDoNotMatch")}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {actionData?.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t("error")}</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{actionData.error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-green-400">✅</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">{t("success")}</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{actionData.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          {t("passwordRequirements")}:
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• {t("requirements.8characters")}</li>
          <li>• {t("requirements.uppercase")}</li>
          <li>• {t("requirements.number")}</li>
          <li>• {t("requirements.special")}</li>
          <li>• {t("requirements.spaces")}</li>
          <li>• {t("requirements.different")}</li>
        </ul>
      </div>

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
          {t("clear")}
        </button>
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="px-6 py-2"
        >
          {isSubmitting ? t("changingPassword") : t("changePassword")}
        </Button>
      </div>
    </Form>
  )
}

export default ChangePasswordForm
