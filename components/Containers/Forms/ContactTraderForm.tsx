import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"
import { Form, useActionData } from "react-router"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button/Button"
import FormField from "~/components/Atoms/FormField/FormField"
import { FormInput } from "~/components/Atoms/Input"
import { CSRFToken } from "~/components/Molecules/CSRFToken"
import { ContactTraderSchema } from "~/utils/formValidationSchemas"

interface ItemInfo {
  userPerfumeId: string
  perfumeName: string
  perfumeHouse?: string
  amount?: string
  price?: string
  tradePrice?: string
  tradePreference?: string
}

interface ContactTraderFormProps {
  recipientId: string
  recipientName?: string
  lastResult?: any
  onSubmit?: (formData: FormData) => Promise<void> | void
  onSuccess?: () => void
  className?: string
  itemInfo?: ItemInfo
  itemSubject?: string
}

const ContactTraderForm = ({
  recipientId,
  recipientName,
  lastResult,
  onSubmit,
  onSuccess,
  className = "",
  itemInfo,
  itemSubject,
}: ContactTraderFormProps) => {
  const { t } = useTranslation()
  const actionData = useActionData()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Use actionData if available, otherwise use lastResult prop
  const result = actionData || lastResult

  useEffect(() => {
    // Handle conform-to SubmissionResult format or API response
    if (result) {
      // Handle API response format (from createSuccessResponse/createErrorResponse)
      if (result.success === false) {
        const errorMsg = result.error || result.message || t("contactTrader.error", "Failed to send message")
        setServerError(errorMsg)
        setSuccessMessage(null)
        setIsSubmitting(false)
      } else if (result.success === true || result.status === "success") {
        const successMsg = result.data?.message ||
          result.message ||
          t("contactTrader.success", "Message sent successfully!")
        setSuccessMessage(successMsg)
        setServerError(null)
        setIsSubmitting(false)
        // Call onSuccess callback after a short delay
        if (onSuccess) {
          setTimeout(() => {
            onSuccess()
          }, 1500)
        }
      } else if (result.status === "error") {
        // If it's a conform-to error, the form fields will show the errors automatically
        // Only set serverError for non-field-specific errors
        if (typeof result.error === "string") {
          setServerError(result.error)
        } else if (result.error?.message) {
          setServerError(result.error.message)
        }
        setIsSubmitting(false)
      }
    }
  }, [result, onSuccess, t])

  const [form, { recipientId: recipientIdField, subject, message }] = useForm({
    id: itemInfo ? `contact-item-form-${itemInfo.userPerfumeId}` : "contact-trader-form",
    lastResult: result || null,
    constraint: getZodConstraint(ContactTraderSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ContactTraderSchema })
    },
    defaultValue: {
      recipientId,
      subject: itemSubject || "",
      message: itemInfo
        ? t("contactTrader.itemMessageTemplate", {
            perfumeName: itemInfo.perfumeName,
            perfumeHouse: itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : "",
            amount: itemInfo.amount || "0",
          }) || `I'm interested in ${itemInfo.perfumeName}${itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : ""} (${itemInfo.amount || "0"}ml).`
        : "",
    },
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      event.preventDefault()
      setServerError(null)
      setSuccessMessage(null)
      setIsSubmitting(true)

      const formData = new FormData(event.currentTarget)
      try {
        await onSubmit(formData)
        // Success handling is done via lastResult in useEffect
      } catch (error) {
        setServerError(
          error instanceof Error ? error.message : t("contactTrader.error", "Failed to send message")
        )
        setIsSubmitting(false)
      }
    }
  }

  return (
    <form
      {...getFormProps(form)}
      onSubmit={handleSubmit}
      autoComplete="off"
      className={`space-y-4 ${className}`}
    >
      {/* Hidden recipient ID field */}
      <input type="hidden" name="recipientId" value={recipientId} />

      {/* Subject field */}
      <FormInput
        inputType="text"
        inputId="subject"
        action={subject}
        label={t("contactTrader.subjectLabel", "Subject (optional)")}
        placeholder={t("contactTrader.subjectPlaceholder", "Enter subject...")}
        maxLength={200}
        shading={true}
        disabled={isSubmitting}
      />

      {/* Message field */}
      <FormField
        label={t("contactTrader.messageLabel", "Message")}
        error={message.errors?.[0]}
        required
        helpText={t(
          "contactTrader.messageHelp",
          "Your message to the trader (10-5,000 characters)"
        )}
      >
        <textarea
          name={message.name}
          key={message.key}
          defaultValue={message.initialValue}
          ref={textareaRef}
          rows={6}
          placeholder={t("contactTrader.messagePlaceholder", "Enter your message...")}
          minLength={10}
          maxLength={5000}
          aria-label={t("contactTrader.messageLabel", "Message")}
          aria-invalid={message.errors ? true : undefined}
          aria-describedby={message.errors ? `${message.id}-error` : undefined}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-y"
          disabled={isSubmitting}
        />
      </FormField>

      {/* Server error message - MUST be before success */}
      {serverError && (
        <div className="bg-red-500 text-white text-sm font-semibold px-4 py-3 rounded-lg" data-testid="error-message">
          <strong>Error:</strong> {serverError}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-500 text-white text-sm font-semibold px-4 py-3 rounded-lg" data-testid="success-message">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {/* CSRF Token */}
      <CSRFToken />

      {/* Submit button */}
      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting
            ? t("contactTrader.sending", "Sending...")
            : t("contactTrader.sendButton", "Send Message")}
        </Button>
      </div>
    </form>
  )
}

export default ContactTraderForm

