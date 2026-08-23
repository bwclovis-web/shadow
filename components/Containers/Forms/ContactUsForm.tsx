"use client"

import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import {
  submitContactUsAction,
  type ContactUsActionState,
  type ContactPendingFatal,
} from "@/app/correspondence/actions"
import { Button } from "@/components/Atoms/Button/Button"
import FormField from "@/components/Atoms/FormField/FormField"
import { FormInput } from "@/components/Atoms/Input"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import { TurnstileField } from "@/components/Molecules/Turnstile/TurnstileField"
import { ContactUsSchema } from "@/utils/validation/formValidationSchemas"
import { getTranslatedError } from "@/utils/validation/validationKeys"

const isFatal = (s: ContactUsActionState): s is ContactPendingFatal =>
  s != null &&
  typeof s === "object" &&
  "_fatal" in s &&
  (s as ContactPendingFatal)._fatal === true

const ContactUsForm = () => {
  const t = useTranslations("contactUs.contact")
  const tValidation = useTranslations()
  const [state, formAction, isPending] = useActionState(
    submitContactUsAction,
    null as ContactUsActionState
  )
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const lastResult: SubmissionResult | null =
    state && !isFatal(state) ? (state as SubmissionResult) : null

  const [form, fields] = useForm({
    id: "contact-us-form",
    lastResult,
    constraint: getZodConstraint(ContactUsSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ContactUsSchema })
    },
  })

  useEffect(() => {
    if (!state) return
    if (isFatal(state)) {
      setServerError(state.message)
      setSuccessMessage(null)
      return
    }
    if (state.status === "success") {
      setServerError(null)
      setSuccessMessage(t("success"))
      form.reset()
    }
    // Only react to action state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, t])

  const fieldError = (errors: string[] | undefined) =>
    getTranslatedError(errors, key => tValidation(key as never))

  return (
    <form
      {...getFormProps(form)}
      action={formAction}
      className="relative flex flex-col gap-4"
      noValidate
    >
      <CSRFToken />

      {/* Honeypot — hidden from users */}
      <div
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <FormInput
        inputType="text"
        inputId={fields.name.id}
        action={fields.name}
        label={t("nameLabel")}
        placeholder={t("namePlaceholder")}
        error={fieldError(fields.name.errors)}
        required
        shading
        disabled={isPending || !!successMessage}
      />

      <FormInput
        inputType="email"
        inputId={fields.email.id}
        action={fields.email}
        label={t("emailFieldLabel")}
        placeholder={t("emailPlaceholder")}
        error={fieldError(fields.email.errors)}
        required
        shading
        disabled={isPending || !!successMessage}
      />

      <FormInput
        inputType="text"
        inputId={fields.subject.id}
        action={fields.subject}
        label={t("subjectLabel")}
        placeholder={t("subjectPlaceholder")}
        error={fieldError(fields.subject.errors)}
        shading
        disabled={isPending || !!successMessage}
      />

      <FormField
        label={t("messageLabel")}
        error={fieldError(fields.message.errors)}
        required
      >
        <textarea
          id={fields.message.id}
          name={fields.message.name}
          key={fields.message.key}
          defaultValue={fields.message.initialValue}
          rows={5}
          placeholder={t("messagePlaceholder")}
          minLength={10}
          maxLength={5000}
          disabled={isPending || !!successMessage}
          aria-invalid={fields.message.errors ? true : undefined}
          className="block w-full resize-y rounded-md border border-noir-gold/40 bg-noir-black px-3 py-2 text-noir-light shadow-sm focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:cursor-not-allowed disabled:opacity-50"
        />
      </FormField>

      {serverError && (
        <div
          className="rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white"
          role="alert"
        >
          {serverError}
        </div>
      )}

      {successMessage && (
        <div
          className="rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <>
          <TurnstileField />
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
            className="max-w-max"
          >
            {isPending ? t("sending") : t("submitButton")}
          </Button>
        </>
      )}
    </form>
  )
}

export default ContactUsForm
