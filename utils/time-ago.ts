export const formatTimeAgo = (date: Date | string): string => {
  const now = new Date()
  const dateObj = typeof date === "string" ? new Date(date) : date
  const diffInMinutes = Math.floor(
    (now.getTime() - dateObj.getTime()) / (1000 * 60)
  )

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  return dateObj.toLocaleDateString("en-US")
}
