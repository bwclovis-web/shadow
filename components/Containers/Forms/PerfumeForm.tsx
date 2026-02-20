import { getFormProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"
import { Form, useSubmit } from "react-router"

import { Button } from "~/components/Atoms/Button/Button"
import FormField from "~/components/Atoms/FormField/FormField"
import HouseTypeahead from "~/components/Molecules/HouseTypeahead/HouseTypeahead"
import Input from "~/components/Atoms/Input/Input"
import { CSRFToken } from "~/components/Molecules/CSRFToken"
import TagSearch from "~/components/Organisms/TagSearch/TagSearch"
import { FORM_TYPES } from "~/utils/constants"
import { CreatePerfumeSchema } from "~/utils/formValidationSchemas"

// Type for perfume data used in the form
type PerfumeFormData = {
  id?: string
  name?: string
  description?: string | null
  image?: string | null
  perfumeHouseId?: string | null
  perfumeHouse?: {
    id: string
    name: string
  } | null
  perfumeNotesOpen?: Array<{ id: string; name: string }>
  perfumeNotesHeart?: Array<{ id: string; name: string }>
  perfumeNotesClose?: Array<{ id: string; name: string }>
}

interface PerfumeFormProps {
  formType: (typeof FORM_TYPES)[keyof typeof FORM_TYPES]
  lastResult: any
  data?: PerfumeFormData | null
  onSubmit?: (formData: FormData) => Promise<void> | void
  submitButtonText?: string
  className?: string
  hideImage?: boolean
  hideNotes?: boolean
  allowCreateNotes?: boolean
}
/* eslint-disable complexity */
const PerfumeForm = ({
  formType,
  lastResult,
  data,
  onSubmit,
  submitButtonText,
  className,
  hideImage = false,
  hideNotes = false,
  allowCreateNotes = true,
}: PerfumeFormProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const submit = useSubmit()
  const [topNotes, setTopNotes] = useState<any[]>(data?.perfumeNotesOpen || [])
  const [heartNotes, setHeartNotes] = useState<any[]>(data?.perfumeNotesHeart || [])
  const [baseNotes, setBaseNotes] = useState<any[]>(data?.perfumeNotesClose || [])
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

  // Update state when data changes (e.g., when editing an existing perfume)
  useEffect(() => {
    if (data?.perfumeNotesOpen) {
      setTopNotes(data.perfumeNotesOpen)
    }
    if (data?.perfumeNotesHeart) {
      setHeartNotes(data.perfumeNotesHeart)
    }
    if (data?.perfumeNotesClose) {
      setBaseNotes(data.perfumeNotesClose)
    }
  }, [data])


  // Dynamically update hidden inputs when note states change
  useEffect(() => {
    if (hideNotes) {
      // Don't add note inputs if notes are hidden
      return
    }

    const formElement = document.getElementById(formType)
    if (!formElement) {
      console.error("Form element not found with id:", formType)
      return
    }

    // Remove existing note inputs
    const existingInputs = formElement.querySelectorAll('input[name^="notes"]')
    existingInputs.forEach(input => input.remove())

    // Add current note states as hidden inputs
    topNotes.forEach(note => {
      if (!note.id) {
        console.warn("Note missing id:", note)
        return
      }
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "notesTop"
      input.value = note.id
      formElement.appendChild(input)
    })

    heartNotes.forEach(note => {
      if (!note.id) {
        console.warn("Note missing id:", note)
        return
      }
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "notesHeart"
      input.value = note.id
      formElement.appendChild(input)
    })

    baseNotes.forEach(note => {
      if (!note.id) {
        console.warn("Note missing id:", note)
        return
      }
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "notesBase"
      input.value = note.id
      formElement.appendChild(input)
    })
  }, [
topNotes, heartNotes, baseNotes, formType, hideNotes
])

  const [form, { name, description, image, house }] = useForm({
    id: formType,
    lastResult: lastResult || null,
    constraint: getZodConstraint(CreatePerfumeSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: CreatePerfumeSchema })
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
      className={className || "p-6 rounded-md noir-border max-w-6xl mx-auto bg-noir-dark/10 flex flex-col gap-3"}
    >
      <FormField label="Name" error={name?.errors?.[0]} required>
        <Input
          inputType="text"
          action={name}
          shading={true}
          ref={inputRef}
          inputId="name"
          defaultValue={data?.name || ""}
        />
      </FormField>
      <FormField label="Description" error={description?.errors?.[0]}>
        <Input
          inputType="text"
          inputRef={inputRef}
          action={description}
          inputId="description"
          shading={true}
          defaultValue={data?.description || ""}
        />
      </FormField>
      {!hideImage && (
        <FormField label="Image URL" error={image?.errors?.[0]}>
          <Input
            shading={true}
            inputType="text"
            inputRef={inputRef}
            action={image}
            inputId="image"
            defaultValue={data?.image || ""}
          />
        </FormField>
      )}
      <div>
        <HouseTypeahead
          name="house"
          label="Perfume House"
          defaultId={data?.perfumeHouseId || undefined}
          defaultName={data?.perfumeHouse?.name}
        />
        {house.errors && (
          <div className="text-red-400 text-sm mt-1">{house.errors}</div>
        )}
      </div>
      {!hideNotes && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <TagSearch
            name="notesTop"
            label="Top Notes"
            onChange={setTopNotes as any}
            data={data?.perfumeNotesOpen as any}
            allowCreate={allowCreateNotes}
          />

          <TagSearch
            name="notesHeart"
            label="Heart Notes"
            onChange={setHeartNotes as any}
            data={data?.perfumeNotesHeart as any}
            allowCreate={allowCreateNotes}
          />

          <TagSearch
            name="notesBase"
            label="Base Notes"
            onChange={setBaseNotes as any}
            data={data?.perfumeNotesClose as any}
            allowCreate={allowCreateNotes}
          />
        </div>
      )}
      <CSRFToken />
      {data?.id && <input type="hidden" name="perfumeId" value={data.id} />}
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
      <Button type="submit" className="max-w-max">
        {submitButtonText ||
          (formType === FORM_TYPES.CREATE_PERFUME_FORM
            ? "Create Perfume"
            : "Update Perfume")}
      </Button>
    </Form>
  )
}

export default PerfumeForm
