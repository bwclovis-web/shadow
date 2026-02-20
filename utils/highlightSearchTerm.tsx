import { type ReactNode } from "react"

/**
 * Wraps matching parts of `text` (case-insensitive) in <mark> for the given `searchTerm`.
 * Returns a string if no match, or React nodes (string + <mark> fragments) when there is a match.
 */
export function highlightSearchTerm(text: string, searchTerm: string): ReactNode {
  if (!searchTerm.trim()) return text
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi")
  const parts = text.split(regex)
  if (parts.length === 1) return text
  // Odd-indexed segments are the regex matches
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-noir-gold/40 text-inherit font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
