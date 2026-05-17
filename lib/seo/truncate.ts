export const truncateDescription = (
  text: string | null | undefined,
  maxLength = 160
): string | undefined => {
  if (!text?.trim()) return undefined
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 1)}…`
}
