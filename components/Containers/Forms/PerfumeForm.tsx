"use client"

import { getFormProps, useForm } from "@conform-to/react"
import type { SubmissionResult } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import FormField from "@/components/Atoms/FormField/FormField"
import ValidationMessage from "@/components/Atoms/ValidationMessage/ValidationMessage"
import HouseTypeahead from "@/components/Molecules/HouseTypeahead/HouseTypeahead"
import Input from "@/components/Atoms/Input/Input"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import { FORM_TYPES } from "@/constants/general"
import { CreatePerfumeSchema } from "@/utils/validation/formValidationSchemas"
import { getTranslatedError } from "@/utils/validation/validationKeys"

type NoteItem = { id: string; name: string }

type PerfumeFormData = {
  id?: string
  name?: string
  description?: string | null
  image?: string | null
  perfumeHouseId?: string | null
  perfumeHouse?: { id: string; name: string } | null
  perfumeNotesOpen?: NoteItem[]
  perfumeNotesHeart?: NoteItem[]
  perfumeNotesClose?: NoteItem[]
}

interface PerfumeFormProps {
  formType: (typeof FORM_TYPES)[keyof typeof FORM_TYPES]
  lastResult: SubmissionResult | null
  data?: PerfumeFormData | null
  onSubmit?: (formData: FormData) => Promise<void> | void
  submitButtonText?: string
  className?: string
  hideImage?: boolean
  hideNotes?: boolean
  allowCreateNotes?: boolean
  /** Form POST URL or Next.js server action (function) */
  action?: string | ((formData: FormData) => void)
}

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
  action,
}: PerfumeFormProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [topNotes, setTopNotes] = useState<NoteItem[]>(data?.perfumeNotesOpen ?? [])
  const [heartNotes, setHeartNotes] = useState<NoteItem[]>(data?.perfumeNotesHeart ?? [])
  const [baseNotes, setBaseNotes] = useState<NoteItem[]>(data?.perfumeNotesClose ?? [])

  const submittedValues =
    lastResult?.status === "error" &&
    lastResult.initialValue &&
    typeof lastResult.initialValue === "object"
      ? (lastResult.initialValue as Record<string, unknown>)
      : undefined

  const effectiveData = ((): PerfumeFormData | undefined => {
    if (data) return data
    if (!submittedValues) return undefined
    return {
      name: submittedValues.name as string | undefined,
      description: submittedValues.description as string | undefined,
      image: submittedValues.image as string | undefined,
      perfumeHouseId: submittedValues.house as string | undefined,
      perfumeNotesOpen: Array.isArray(submittedValues.notesTop)
        ? (submittedValues.notesTop as string[]).map((id) => ({ id, name: "" }))
        : undefined,
      perfumeNotesHeart: Array.isArray(submittedValues.notesHeart)
        ? (submittedValues.notesHeart as string[]).map((id) => ({ id, name: "" }))
        : undefined,
      perfumeNotesClose: Array.isArray(submittedValues.notesBase)
        ? (submittedValues.notesBase as string[]).map((id) => ({ id, name: "" }))
        : undefined,
    }
  })()
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (lastResult?.status === "error" && typeof lastResult.error === "string") {
      setServerError(lastResult.error)
    }
  }, [lastResult])

  const [form, { name, description, image, house }] = useForm({
    id: formType,
    lastResult: lastResult ?? undefined,
    constraint: getZodConstraint(CreatePerfumeSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: CreatePerfumeSchema }),
  })

  useEffect(() => {
    if (lastResult?.status !== "error") return
    const fieldIds = ["name", "description", ...(hideImage ? [] : ["image"]), "house"]
    const fieldsWithErrors = [name, description, ...(hideImage ? [] : [image]), house]
    const firstErrorIndex = fieldsWithErrors.findIndex(
      (field) => field?.errors && field.errors.length > 0
    )
    if (firstErrorIndex < 0) return
    const id = fieldIds[firstErrorIndex]
    const el = id ? document.getElementById(id) : null
    if (el && "focus" in el && typeof (el as HTMLInputElement).focus === "function") {
      ;(el as HTMLInputElement).focus({ preventScroll: false })
    }
  }, [lastResult?.status, hideImage, name, description, image, house])

  useEffect(() => {
    if (!effectiveData?.perfumeNotesOpen && !effectiveData?.perfumeNotesHeart && !effectiveData?.perfumeNotesClose) return
    if (effectiveData.perfumeNotesOpen) setTopNotes(effectiveData.perfumeNotesOpen)
    if (effectiveData.perfumeNotesHeart) setHeartNotes(effectiveData.perfumeNotesHeart)
    if (effectiveData.perfumeNotesClose) setBaseNotes(effectiveData.perfumeNotesClose)
  }, [effectiveData?.perfumeNotesOpen, effectiveData?.perfumeNotesHeart, effectiveData?.perfumeNotesClose])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!onSubmit) return
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

  const formClassName =
    className ??
    "p-6 rounded-md noir-border max-w-6xl mx-auto bg-noir-dark/10 flex flex-col gap-3"

  const t = useTranslations()
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
      className={formClassName}
    >
      <FormField
        label="Name"
        error={getTranslatedError(name?.errors, t)}
        required
      >
        <Input
          inputType="text"
          action={name}
          shading={true}
          ref={inputRef}
          inputId="name"
          defaultValue={effectiveData?.name ?? ""}
        />
      </FormField>
      <FormField
        label="Description"
        error={getTranslatedError(description?.errors, t)}
      >
        <Input
          inputType="text"
          inputRef={inputRef}
          action={description}
          inputId="description"
          shading={true}
          defaultValue={effectiveData?.description ?? ""}
        />
      </FormField>
      {!hideImage && (
        <FormField label="Image URL" error={getTranslatedError(image?.errors, t)}>
          <Input
            shading={true}
            inputType="text"
            inputRef={inputRef}
            action={image}
            inputId="image"
            defaultValue={effectiveData?.image ?? ""}
          />
        </FormField>
      )}
      <div className="space-y-1">
        <HouseTypeahead
          name="house"
          label="Perfume House"
          defaultId={effectiveData?.perfumeHouseId ?? undefined}
          defaultName={effectiveData?.perfumeHouse?.name}
        />
        <ValidationMessage
          error={getTranslatedError(house?.errors, t)}
          size="sm"
        />
      </div>
      {!hideNotes && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <TagSearch
            name="notesTop"
            label="Top Notes"
            onChange={setTopNotes}
            data={effectiveData?.perfumeNotesOpen}
            allowCreate={allowCreateNotes}
          />
          <TagSearch
            name="notesHeart"
            label="Heart Notes"
            onChange={setHeartNotes}
            data={effectiveData?.perfumeNotesHeart}
            allowCreate={allowCreateNotes}
          />
          <TagSearch
            name="notesBase"
            label="Base Notes"
            onChange={setBaseNotes}
            data={effectiveData?.perfumeNotesClose}
            allowCreate={allowCreateNotes}
          />
        </div>
      )}
      {!hideNotes && (
        <>
          {topNotes.map(
            (note) =>
              note.id && (
                <input
                  key={`top-${note.id}`}
                  type="hidden"
                  name="notesTop"
                  value={note.id}
                />
              )
          )}
          {heartNotes.map(
            (note) =>
              note.id && (
                <input
                  key={`heart-${note.id}`}
                  type="hidden"
                  name="notesHeart"
                  value={note.id}
                />
              )
          )}
          {baseNotes.map(
            (note) =>
              note.id && (
                <input
                  key={`base-${note.id}`}
                  type="hidden"
                  name="notesBase"
                  value={note.id}
                />
              )
          )}
        </>
      )}
      <CSRFToken />
      {effectiveData?.id != null && (
        <input type="hidden" name="perfumeId" value={effectiveData.id} />
      )}
      {successMessage != null && (
        <div className="bg-green-500 text-white text-lg font-semibold px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {serverError != null && (
        <div className="bg-red-500 text-lg font-semibold px-3 py-2 max-w-max rounded-2xl border-2 text-white">
          {serverError}
        </div>
      )}
      <Button type="submit" className="max-w-max">
        {submitButtonText ??
          (formType === FORM_TYPES.CREATE_PERFUME_FORM
            ? "Create Perfume"
            : "Update Perfume")}
      </Button>
    </form>
  )
}

export default PerfumeForm
