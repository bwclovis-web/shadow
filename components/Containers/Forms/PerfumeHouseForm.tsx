"use client"

import { getFormProps, useForm } from "@conform-to/react"
import type { SubmissionResult } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import { FORM_TYPES } from "@/constants/general"
import { CreatePerfumeHouseSchema } from "@/utils/validation/formValidationSchemas"

import AddressFieldset from "./Partials/AddressFieldset"
import ContactFieldset from "./Partials/ContactFiledset"
import InfoFieldset from "./Partials/InfoFieldset"

type PerfumeHouseFormData = {
  id?: string
  name?: string
  description?: string | null
  image?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  country?: string | null
  founded?: string | null
  type?: string | null
}

const formClassName =
  "p-6 rounded-md mt-6 noir-border flex flex-col gap-3 max-w-6xl mx-auto bg-noir-dark/10"

interface PerfumeHouseFormProps {
  formType: (typeof FORM_TYPES)[keyof typeof FORM_TYPES]
  lastResult: SubmissionResult | null
  data?: PerfumeHouseFormData | null
  onSubmit?: (formData: FormData) => Promise<void> | void
  submitButtonText?: string
  className?: string
  hideImage?: boolean
  /** Form POST URL or Next.js server action (function) */
  action?: string | ((formData: FormData) => void)
}

const displayErrorFromResult = (
  result: SubmissionResult | null
): string | null =>
  result?.status === "error" && typeof result.error === "string"
    ? result.error
    : null

/** Ordered field ids (for focus). Image omitted when hideImage. */
const getOrderedFieldIds = (hideImage: boolean): string[] => {
  const base = ["name", "description", "founded", "type"]
  if (!hideImage) base.push("image")
  return [...base, "address", "country", "phone", "email", "website"]
}

const PerfumeHouseForm = ({
  formType,
  lastResult,
  data,
  onSubmit,
  submitButtonText,
  className,
  hideImage = false,
  action,
}: PerfumeHouseFormProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [form, fieldset] = useForm({
    id: formType,
    lastResult: lastResult ?? undefined,
    constraint: getZodConstraint(CreatePerfumeHouseSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: CreatePerfumeHouseSchema }),
  })

  const { name, description, image, website, email, phone, address, founded, type, country } =
    fieldset

  const displayError =
    displayErrorFromResult(lastResult) ?? submitError

  const submittedValues =
    lastResult?.status === "error" &&
    lastResult.initialValue &&
    typeof lastResult.initialValue === "object"
      ? (lastResult.initialValue as Record<string, unknown>)
      : undefined
  const effectiveData = (data ?? submittedValues) as PerfumeHouseFormData | undefined

  useEffect(() => {
    if (!displayError) return
    const fieldIds = getOrderedFieldIds(hideImage)
    const fieldsWithErrors = [
      name,
      description,
      founded,
      type,
      ...(hideImage ? [] : [image]),
      address,
      country,
      phone,
      email,
      website,
    ]
    const firstErrorIndex = fieldsWithErrors.findIndex(
      (field) => field?.errors && field.errors.length > 0
    )
    const indexToFocus = firstErrorIndex >= 0 ? firstErrorIndex : 0
    const id = fieldIds[indexToFocus]
    const el = id ? document.getElementById(id) : null
    if (el && "focus" in el && typeof (el as HTMLInputElement).focus === "function") {
      ;(el as HTMLInputElement).focus({ preventScroll: false })
    }
  }, [displayError, hideImage, name, description, founded, type, image, address, country, phone, email, website])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!onSubmit) return
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    const formData = new FormData(event.currentTarget)
    try {
      await onSubmit(formData)
      setSuccessMessage("Your submission has been received!")
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit request"
      )
    }
  }

  const addressData = effectiveData
    ? { address: effectiveData.address ?? "", country: effectiveData.country ?? "" }
    : undefined
  const contactData = effectiveData
    ? {
        phone: effectiveData.phone ?? "",
        email: effectiveData.email ?? "",
        website: effectiveData.website ?? "",
      }
    : undefined
  const submitLabel =
    submitButtonText ??
    (formType === FORM_TYPES.CREATE_HOUSE_FORM
      ? "Create Perfume House"
      : "Submit Changes")

  const isServerAction = typeof action === "function"
  const formProps = getFormProps(form)
  if (isServerAction) {
    delete (formProps as Record<string, unknown>).method
    delete (formProps as Record<string, unknown>).encType
  }

  return (
    <form
      {...formProps}
      {...(!isServerAction && !onSubmit && { method: "post" })}
      action={onSubmit ? undefined : action}
      onSubmit={onSubmit ? handleSubmit : undefined}
      autoComplete="off"
      className={className ?? formClassName}
    >
      <InfoFieldset
        data={effectiveData ?? undefined}
        actions={{ name, description, image, founded, type }}
        hideImage={hideImage}
      />
      <AddressFieldset
        address={address}
        country={country}
        inputRef={inputRef}
        data={addressData}
      />
      <ContactFieldset
        inputRef={inputRef}
        data={contactData}
        actions={{ phone, website, email }}
      />
      {successMessage && (
        <div className="bg-green-500 text-white text-lg font-semibold px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {displayError && (
        <div className="bg-red-500 text-lg font-semibold px-3 py-2 max-w-max rounded-2xl border-2 text-white">
          {displayError}
        </div>
      )}
      <CSRFToken />
      <input type="hidden" name="houseId" value={effectiveData?.id ?? ""} />
      <Button type="submit" className="mt-4 max-w-max">
        {submitLabel}
      </Button>
    </form>
  )
}

export default PerfumeHouseForm
