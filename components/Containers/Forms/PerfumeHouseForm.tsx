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
  /** For traditional form POST when onSubmit is not provided (e.g. Next.js server action URL) */
  action?: string
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
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (lastResult?.status === "error" && typeof lastResult.error === "string") {
      setServerError(lastResult.error)
    }
  }, [lastResult])

  const [
    form,
    { name, description, image, website, email, phone, address, founded, type, country },
  ] = useForm({
    id: formType,
    lastResult: lastResult ?? undefined,
    constraint: getZodConstraint(CreatePerfumeHouseSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: CreatePerfumeHouseSchema }),
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (onSubmit) {
      event.preventDefault()
      setServerError(null)
      setSuccessMessage(null)

      const formData = new FormData(event.currentTarget)
      try {
        await onSubmit(formData)
        setSuccessMessage("Your submission has been received!")
      } catch (error) {
        setServerError(
          error instanceof Error ? error.message : "Failed to submit request"
        )
      }
    }
  }

  return (
    <form
      method={onSubmit ? undefined : "post"}
      action={onSubmit ? undefined : action}
      {...getFormProps(form)}
      onSubmit={onSubmit ? handleSubmit : undefined}
      autoComplete="off"
      className={className ?? formClassName}
    >
      <InfoFieldset
        data={data ?? undefined}
        actions={{ name, description, image, founded, type }}
        hideImage={hideImage}
      />
      <AddressFieldset
        address={address}
        country={country}
        inputRef={inputRef}
        data={
          data
            ? { address: data.address ?? "", country: data.country ?? "" }
            : undefined
        }
      />
      <ContactFieldset
        inputRef={inputRef}
        data={
          data
            ? {
                phone: data.phone ?? "",
                email: data.email ?? "",
                website: data.website ?? "",
              }
            : undefined
        }
        actions={{ phone, website, email }}
      />
      {successMessage && (
        <div className="bg-green-500 text-white text-lg font-semibold px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {serverError && (
        <div className="bg-red-500 text-lg font-semibold px-3 py-2 max-w-max rounded-2xl border-2 text-white">
          {serverError}
        </div>
      )}
      <CSRFToken />
      <input type="hidden" name="houseId" value={data?.id} />
      <Button type="submit" className="mt-4 max-w-max">
        {submitButtonText ??
          (formType === FORM_TYPES.CREATE_HOUSE_FORM
            ? "Create Perfume House"
            : "Submit Changes")}
      </Button>
    </form>
  )
}
export default PerfumeHouseForm
