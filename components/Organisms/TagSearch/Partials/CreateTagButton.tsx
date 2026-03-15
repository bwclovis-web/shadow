import { useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import { useCSRF } from "@/hooks/useCSRF"

type CreatedTag = { id: string; name?: string }

type CreateTagButtonProps = {
  action: (res: CreatedTag) => void
  setOpenDropdown: (open: boolean) => void
}

const CreateTagButton = ({ action, setOpenDropdown }: CreateTagButtonProps) => {
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
        const message = body?.error ?? body?.message ?? `Failed to create tag (${response.status})`
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
    <div className="flex flex-col gap-2">
      <label htmlFor="tag-search">Create new tag</label>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <input
        type="text"
        autoComplete="off"
        id="tag-search"
        value={tagValue}
        onChange={evt => setTagValue(evt.target.value)}
        className="w-full rounded-sm border border-gray-500 px-2 py-1 text-lg mt-1 transition-all focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-noir-gold focus:border-transparent focus:ring-offset-2 dark:bg-noir-gray dark:text-white dark:focus:bg-noir-gray/20 dark:focus:ring-offset-noir-gray"
      />
      <Button
        className="block w-full h-full max-w-max mt-2"
        type="button"
        size="md"
        disabled={isSubmitting}
        onClick={handleCreateTag}
      >
        {isSubmitting ? "Creating…" : "Create Tag"}
      </Button>
    </div>
  )
}

export default CreateTagButton
