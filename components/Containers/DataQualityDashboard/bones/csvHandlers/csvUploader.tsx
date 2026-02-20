import type { ChangeEvent } from "react"

// Helper function to get CSRF token from cookies (fallback method)
const getCSRFTokenFromCookies = (): string | null => {
  const cookies = document.cookie.split(";")
  const csrfCookie = cookies.find(cookie => cookie.trim().startsWith("_csrf="))
  return csrfCookie ? csrfCookie.split("=")[1] : null
}

// Validate file selection and type
const validateFile = (file: File | undefined): string | null => {
  if (!file) {
    return "Please select a CSV file to upload."
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "Please select a valid CSV file."
  }
  return null
}

// Get CSRF token with fallback
const getCSRFToken = (token: string | null) => token || getCSRFTokenFromCookies()

// Upload CSV file to server
const uploadCSVFile = async (text: string, token: string): Promise<Response> => {
  const headers: Record<string, string> = {
    "Content-Type": "text/csv",
    "x-csrf-token": token,
  }

  return fetch("/api/update-house-info", {
    method: "POST",
    headers,
    body: text,
  })
}

// Process upload results and show appropriate messages
const processUploadResults = (result: {
  error?: string
  results?: Array<{ status: string }>
}): void => {
  if (result.error) {
    alert("Error updating houses: " + result.error)
    return
  }

  const successCount =
    result.results?.filter(r => r.status === "created" || r.status === "updated").length || 0
  const errorCount = result.results?.filter(r => r.status === "error").length || 0

  if (errorCount > 0) {
    alert(`CSV uploaded with issues: ${successCount} successful, ${errorCount} errors. Check console for details.`)
  } else {
    alert(`CSV uploaded successfully! Updated: ${successCount} houses`)
  }

  // Only reload if there were successful updates
  if (successCount > 0) {
    window.location.reload()
  }
}

// Handle upload errors
const handleUploadError = (error: unknown): void => {
  console.error("CSV upload error:", error)
  const errorMessage = error instanceof Error ? error.message : String(error)
  alert("Failed to upload CSV: " + errorMessage)
}

// Create a function that can be called with CSRF token from the component
export const createHandleUploadCSV =
  (csrfToken: string | null) => async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      const validationError = validateFile(file)
      if (validationError) {
        alert(validationError)
        return
      }

      const text = await file!.text()
      const token = getCSRFToken(csrfToken)

      if (!token) {
        alert("CSRF token not found. Please refresh the page and try again.")
        return
      }

      const res = await uploadCSVFile(text, token)
      const result = await res.json()

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${result.error || "Unknown error"}`)
      }

      processUploadResults(result)
    } catch (error) {
      handleUploadError(error)
  }
}
