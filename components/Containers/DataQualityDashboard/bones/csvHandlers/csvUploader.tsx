import type { ChangeEvent } from "react"

const getCSRFTokenFromCookies = (): string | null => {
  const cookies = document.cookie.split(";")
  const csrfCookie = cookies.find(cookie => cookie.trim().startsWith("_csrf="))
  return csrfCookie ? csrfCookie.split("=")[1] : null
}

const validateFile = (file: File | undefined): string | null => {
  if (!file) {
    return "Please select a CSV file to upload."
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "Please select a valid CSV file."
  }
  return null
}

const getCSRFToken = (token: string | null) => token || getCSRFTokenFromCookies()

const uploadCSVFile = async (text: string, token: string): Promise<Response> =>
  fetch("/api/update-house-info", {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
      "x-csrf-token": token,
    },
    body: text,
  })

export type CsvUploadResult =
  | {
      ok: true
      successCount: number
      errorCount: number
      rowMessages: string[]
    }
  | { ok: false; message: string }

export const createHandleUploadCSV =
  (csrfToken: string | null) =>
  async (event: ChangeEvent<HTMLInputElement>): Promise<CsvUploadResult> => {
    const file = event.target.files?.[0]
    const validationError = validateFile(file)
    if (validationError) {
      return { ok: false, message: validationError }
    }

    const text = await file!.text()
    const token = getCSRFToken(csrfToken)

    if (!token) {
      return { ok: false, message: "CSRF token not found. Please refresh the page and try again." }
    }

    const res = await uploadCSVFile(text, token)
    const result = (await res.json()) as {
      error?: string
      results?: Array<{ status: string; message?: string }>
    }

    if (!res.ok) {
      return {
        ok: false,
        message: result.error || `HTTP ${res.status}: upload failed`,
      }
    }

    if (result.error) {
      return { ok: false, message: result.error }
    }

    const successCount =
      result.results?.filter(r => r.status === "created" || r.status === "updated").length || 0
    const errorEntries = result.results?.filter(r => r.status === "error") || []
    const errorCount = errorEntries.length
    const rowMessages = errorEntries
      .map(r => r.message)
      .filter((m): m is string => typeof m === "string" && m.length > 0)

    return { ok: true, successCount, errorCount, rowMessages }
  }
