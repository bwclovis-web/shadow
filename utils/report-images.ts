const MAX_REPORT_IMAGES = 3

export const parseReportImagesJson = (
  raw: FormDataEntryValue | null
): string[] => {
  if (!raw || typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      .slice(0, MAX_REPORT_IMAGES)
  } catch {
    return []
  }
}
