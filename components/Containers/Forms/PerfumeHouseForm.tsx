import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"
import { Form } from "react-router"

import { Button } from "~/components/Atoms/Button/Button"
import { CSRFToken } from "~/components/Molecules/CSRFToken"
import { FORM_TYPES } from "~/utils/constants"
import { CreatePerfumeHouseSchema } from "~/utils/formValidationSchemas"

import AddressFieldset from "./Partials/AddressFieldset"
import ContactFieldset from "./Partials/ContactFiledset"
import InfoFieldset from "./Partials/InfoFieldset"

interface PerfumeHouseFormProps {
  formType: (typeof FORM_TYPES)[keyof typeof FORM_TYPES]
  lastResult: any
  data?: any
  onSubmit?: (formData: FormData) => Promise<void> | void
  submitButtonText?: string
  className?: string
  hideImage?: boolean
}

const PerfumeHouseForm = ({
  formType,
  lastResult,
  data,
  onSubmit,
  submitButtonText,
  className,
  hideImage = false,
}: PerfumeHouseFormProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  useEffect(() => {
    // Handle conform-to SubmissionResult format
    if (lastResult && lastResult.status === "error") {
      // If it's a conform-to error, the form fields will show the errors automatically
      // Only set serverError for non-field-specific errors
      if (typeof lastResult.error === "string") {
        setServerError(lastResult.error)
      }
    }
  }, [lastResult])
  const [
    form,
    { name, description, image, website, email, phone, address, founded, type, country },
  ] = useForm({
    id: formType,
    lastResult: lastResult || null,
    constraint: getZodConstraint(CreatePerfumeHouseSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: CreatePerfumeHouseSchema })
    },
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
    <Form
      method={onSubmit ? undefined : "POST"}
      {...getFormProps(form)}
      onSubmit={onSubmit ? handleSubmit : undefined}
      autoComplete="off"
      className={className || "p-6 rounded-md mt-6 noir-border flex flex-col gap-3 max-w-6xl mx-auto bg-noir-dark/10"}
    >
      <InfoFieldset
        inputRef={inputRef}
        data={data}
        actions={{ name, description, image, founded, type }}
        hideImage={hideImage}
      />
      <AddressFieldset address={address} country={country} inputRef={inputRef} data={data} />
      <ContactFieldset
        inputRef={inputRef}
        data={data}
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
        {submitButtonText ||
          (formType === FORM_TYPES.CREATE_HOUSE_FORM
            ? "Create Perfume House"
            : "Submit Changes")}
      </Button>
    </Form>
  )
}
export default PerfumeHouseForm
