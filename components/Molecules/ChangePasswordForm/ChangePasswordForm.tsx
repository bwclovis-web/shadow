"use client"

import { type ChangeEvent, type FocusEvent, useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { changePasswordAction } from "@/app/[userSlug]/profile/security/actions"
import { Button } from "@/components/Atoms/Button"
import { FormInput } from "@/components/Atoms/Input"
import ErrorDisplay from "@/components/Containers/ErrorDisplay/ErrorDisplay"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import PasswordStrengthIndicator from "@/components/Organisms/PasswordStrengthIndicator"
import { authSchemas } from "@/utils/validation"
import { getTranslatedError } from "@/utils/validation/validationKeys"

interface ChangePasswordFormProps {
  className?: string
  /** When true, hides the in-form heading (use when a page banner shows the title). */
  hideHeading?: boolean
}

export const ChangePasswordForm = ({
  className = "",
  hideHeading = false,
}: ChangePasswordFormProps) => {
  const t = useTranslations("password")
  const tValidation = useTranslations()
  const [state, formAction, isPending] = useActionState(changePasswordAction, null)

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setTouchedFields((prev) => ({ ...prev, [name]: true }))
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    const { name } = e.target
    setTouchedFields((prev) => ({ ...prev, [name]: true }))
  }

  const fieldError = (fieldName: string) =>
    touchedFields[fieldName]
      ? getTranslatedError(validationErrors[fieldName], tValidation)
      : undefined

  useEffect(() => {
    const result = authSchemas.changePassword.safeParse(formData)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message
        }
      })
      setValidationErrors(errors)
    } else {
      setValidationErrors({})
    }
  }, [formData])

  useEffect(() => {
    if (state?.success) {
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      })
      setTouchedFields({})
    }
  }, [state?.success])

  const clearForm = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    })
    setTouchedFields({})
  }

  const passwordsMatch = formData.newPassword === formData.confirmNewPassword
  const confirmTouched = touchedFields.confirmNewPassword
  const confirmMismatch =
    confirmTouched && formData.confirmNewPassword && !passwordsMatch
      ? t("passwordsDoNotMatch")
      : undefined
  const confirmError =
    fieldError("confirmNewPassword") || confirmMismatch
  const confirmSuccess =
    confirmTouched && formData.confirmNewPassword && !confirmError && passwordsMatch
      ? t("passwordsMatch")
      : undefined

  const isFormValid =
    Object.keys(validationErrors).length === 0 &&
    Boolean(formData.currentPassword) &&
    Boolean(formData.newPassword) &&
    Boolean(formData.confirmNewPassword) &&
    passwordsMatch

  return (
    <form action={formAction} className={`space-y-6 ${className}`} noValidate>
      <CSRFToken />

      {!hideHeading && (
        <div>
          <h2>{t("changePassword")}</h2>
          <p className="text-noir-gold-100">
            {t("updatePasswordToKeepAccountSecure")}
          </p>
        </div>
      )}

      <FormInput
        shading
        inputId="currentPassword"
        label={t("currentPassword")}
        inputType="password"
        name="currentPassword"
        value={formData.currentPassword}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={t("enterCurrentPassword")}
        autoComplete="current-password"
        required
        passwordToggle
        showValidationIcon={false}
        error={fieldError("currentPassword")}
      />

      <div>
        <FormInput
          shading
          inputId="newPassword"
          label={t("newPassword")}
          inputType="password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={t("enterNewPassword")}
          autoComplete="new-password"
          required
          passwordToggle
          showValidationIcon={false}
          error={fieldError("newPassword")}
        />

        {formData.newPassword && (
          <div className="mt-2">
            <PasswordStrengthIndicator password={formData.newPassword} />
          </div>
        )}
      </div>

      <FormInput
        shading
        inputId="confirmNewPassword"
        label={t("confirmNewPassword")}
        inputType="password"
        name="confirmNewPassword"
        value={formData.confirmNewPassword}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={t("confirmNewPasswordPlaceholder")}
        autoComplete="new-password"
        required
        passwordToggle
        showValidationIcon={false}
        error={confirmError}
        success={confirmSuccess}
      />

      {state?.success === false && state.error && (
        <ErrorDisplay
          error={state.error}
          variant="inline"
          title={t("error")}
        />
      )}

      {state?.success && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {state.message}
        </p>
      )}

      <div className="bg-noir-dark border border-noir-gold rounded-md p-3 text-xs text-noir-gold">
        <p className="font-medium mb-1">{t("passwordRequirements")}:</p>
        <ul className="space-y-1">
          <li>• {t("requirements.8characters")}</li>
          <li>• {t("requirements.uppercase")}</li>
          <li>• {t("requirements.number")}</li>
          <li>• {t("requirements.special")}</li>
          <li>• {t("requirements.spaces")}</li>
          <li>• {t("requirements.different")}</li>
        </ul>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={clearForm}>
          {t("clear")}
        </Button>
        <Button
          type="submit"
          variant="icon"
          background="gold"
          size="lg"
          disabled={!isFormValid || isPending}
        >
          {isPending ? t("changingPassword") : t("changePassword")}
        </Button>
      </div>
    </form>
  )
}
