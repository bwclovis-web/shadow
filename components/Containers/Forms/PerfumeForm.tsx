"use client"

import { getFormProps, useForm } from "@conform-to/react"
import type { SubmissionResult } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import FormField from "@/components/Atoms/FormField/FormField"
import HouseTypeahead from "@/components/Molecules/HouseTypeahead/HouseTypeahead"
import Input from "@/components/Atoms/Input/Input"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import { FORM_TYPES } from "@/constants/general"
import { CreatePerfumeSchema } from "@/utils/validation/formValidationSchemas"

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
  /** For traditional form POST when onSubmit is not provided (e.g. Next.js server action URL) */
  action?: string
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
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (lastResult?.status === "error" && typeof lastResult.error === "string") {
      setServerError(lastResult.error)
    }
  }, [lastResult])

  useEffect(() => {
    if (data?.perfumeNotesOpen) setTopNotes(data.perfumeNotesOpen)
    if (data?.perfumeNotesHeart) setHeartNotes(data.perfumeNotesHeart)
    if (data?.perfumeNotesClose) setBaseNotes(data.perfumeNotesClose)
  }, [data?.perfumeNotesOpen, data?.perfumeNotesHeart, data?.perfumeNotesClose])

  const [form, { name, description, image, house }] = useForm({
    id: formType,
    lastResult: lastResult ?? undefined,
    constraint: getZodConstraint(CreatePerfumeSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: CreatePerfumeSchema }),
  })

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

  return (
    <form
      method={onSubmit ? undefined : "post"}
      action={onSubmit ? undefined : action}
      {...getFormProps(form)}
      onSubmit={onSubmit ? handleSubmit : undefined}
      className={formClassName}
    >
      <FormField label="Name" error={name?.errors?.[0]} required>
        <Input
          inputType="text"
          action={name}
          shading={true}
          ref={inputRef}
          inputId="name"
          defaultValue={data?.name ?? ""}
        />
      </FormField>
      <FormField label="Description" error={description?.errors?.[0]}>
        <Input
          inputType="text"
          inputRef={inputRef}
          action={description}
          inputId="description"
          shading={true}
          defaultValue={data?.description ?? ""}
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
            defaultValue={data?.image ?? ""}
          />
        </FormField>
      )}
      <div>
        <HouseTypeahead
          name="house"
          label="Perfume House"
          defaultId={data?.perfumeHouseId ?? undefined}
          defaultName={data?.perfumeHouse?.name}
        />
        {house.errors?.[0] != null && (
          <div className="text-red-400 text-sm mt-1">{house.errors[0]}</div>
        )}
      </div>
      {!hideNotes && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <TagSearch
            name="notesTop"
            label="Top Notes"
            onChange={setTopNotes}
            data={data?.perfumeNotesOpen}
            allowCreate={allowCreateNotes}
          />
          <TagSearch
            name="notesHeart"
            label="Heart Notes"
            onChange={setHeartNotes}
            data={data?.perfumeNotesHeart}
            allowCreate={allowCreateNotes}
          />
          <TagSearch
            name="notesBase"
            label="Base Notes"
            onChange={setBaseNotes}
            data={data?.perfumeNotesClose}
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
      {data?.id != null && (
        <input type="hidden" name="perfumeId" value={data.id} />
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
