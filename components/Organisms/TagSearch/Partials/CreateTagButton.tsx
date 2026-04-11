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
  surface?: "light" | "dark"
}

const CreateTagButton = ({
  action,
  setOpenDropdown,
  createInputId,
  surface = "light",
}: CreateTagButtonProps) => {
  const [tagValue, setTagValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToHeaders, getTokenWithFallback } = useCSRF()

  const isDark = surface === "dark"

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
    <div
      className={styleMerge(
        "flex flex-col gap-3 rounded-lg border p-3",
        isDark
          ? "border-stone-600/80 bg-stone-900/50"
          : "border-stone-200/90 bg-white/60"
      )}
    >
      <label
        htmlFor={createInputId}
        className={styleMerge(
          "text-sm font-semibold tracking-wide",
          isDark ? "text-noir-gold-100" : "text-stone-700"
        )}
      >
        Create new tag
      </label>
      {error && (
        <p
          className={styleMerge(
            "text-sm",
            isDark ? "text-red-400" : "text-red-600"
          )}
          role="alert"
        >
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
          "w-full rounded-md border px-3 py-2 text-sm transition-colors",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-noir-gold/80 focus:ring-offset-0",
          isDark
            ? "border-stone-600 bg-stone-950/80 text-noir-gold-100 placeholder:text-stone-500"
            : "border-stone-300 bg-white text-stone-900 placeholder:text-stone-400"
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
