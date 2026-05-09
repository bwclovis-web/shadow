import { useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import { useCSRF } from "@/hooks/useCSRF"
import { styleMerge } from "@/utils/styleUtils"

type CreatedTag = { id: string; name?: string }

type CreateTagButtonProps = {
  action: (res: CreatedTag) => void
  setOpenDropdown: (open: boolean) => void
  /** Must be unique vs the main tag search input (e.g. `${inputId}-create`). */
  createInputId: string
}

const CreateTagButton = ({
  action,
  setOpenDropdown,
  createInputId,
}: CreateTagButtonProps) => {
  const [tagValue, setTagValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToHeaders, getTokenWithFallback } = useCSRF()

  const handleCreateTag = async () => {
    const trimmed = tagValue.trim()
    if (!trimmed) {
      setError("Enter a tag name")
      return
    }

    if (!getTokenWithFallback()) {
      setError("Security token missing. Please refresh the page and try again.")
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/createTag", {
        method: "POST",
        credentials: "include",
        headers: addToHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ tag: trimmed }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message =
          body?.error ?? body?.message ?? `Failed to create tag (${response.status})`
        setError(message)
        return
      }

      const res = await response.json()
      const tagData = res?.data ?? res
      if (!tagData?.id) {
        setError("Invalid response from server")
        return
      }

      setTagValue("")
      setOpenDropdown(false)
      action(tagData as CreatedTag)
    } catch {
      setError("Could not create tag. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-noir-gold/50 bg-noir-black/60 p-3">
      <label
        htmlFor={createInputId}
        className="text-sm font-semibold tracking-wide text-noir-gold-100"
      >
        Create new tag
      </label>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <input
        id={createInputId}
        type="text"
        name="create-tag"
        autoComplete="off"
        value={tagValue}
        onChange={evt => setTagValue(evt.target.value)}
        className={styleMerge(
          "w-full rounded-md border border-noir-gold/40 bg-noir-black/80 px-3 py-2 text-sm text-noir-gold-100 placeholder:text-noir-gold-100/50 transition-colors",
          "focus:border-noir-gold focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:ring-offset-0"
        )}
        placeholder="Type a name…"
      />
      <Button
        className="w-full sm:w-auto sm:self-start"
        type="button"
        size="md"
        disabled={isSubmitting}
        onClick={handleCreateTag}
      >
        {isSubmitting ? "Creating…" : "Create tag"}
      </Button>
    </div>
  )
}

export default CreateTagButton
