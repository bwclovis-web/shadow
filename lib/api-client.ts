const CSRF_COOKIE_PREFIX = "_csrf="

export const getCSRFFromCookie = (): string | null => {
  if (typeof document === "undefined") return null
  const csrfCookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(CSRF_COOKIE_PREFIX))
  if (!csrfCookie) return null
  const token = csrfCookie.split("=")[1]?.trim()
  return token || null
}

export const getCsrfHeaders = (): HeadersInit => {
  const token = getCSRFFromCookie()
  return token ? { "x-csrf-token": token } : {}
}

export class ApiFetchError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = "ApiFetchError"
    this.status = status
    this.body = body
  }
}

export const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const err = data as { error?: string; message?: string }
    const message = err.error ?? err.message ?? response.statusText
    throw new ApiFetchError(message, response.status, data)
  }

  return data as T
}

export const postFormWithCsrf = (
  url: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getCSRFFromCookie()
  if (token) formData.set("_csrf", token)

  const headers = new Headers(options.headers)
  if (token) headers.set("x-csrf-token", token)

  return fetch(url, {
    ...options,
    method: "POST",
    body: formData,
    credentials: "include",
    headers,
  })
}

export type ImageUploadResponse = {
  success?: boolean
  url?: string
  error?: string
}

export const uploadImage = async (
  endpoint: string,
  file: File | Blob,
  csrfHeaders: HeadersInit,
  defaultFilename = "image.jpg"
): Promise<{ url: string }> => {
  const formData = new FormData()
  const uploadFile =
    file instanceof File ? file : new File([file], defaultFilename, { type: "image/jpeg" })
  formData.append("file", uploadFile)

  try {
    const { getTurnstileTokenForUpload } = await import(
      "@/components/Molecules/Turnstile/TurnstileField"
    )
    const turnstileToken = await getTurnstileTokenForUpload()
    if (turnstileToken) {
      formData.append("cf-turnstile-response", turnstileToken)
    }
  } catch {
    /* Turnstile optional when site key unset */
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: csrfHeaders,
    body: formData,
    credentials: "include",
  })

  const data = (await response.json().catch(() => ({}))) as ImageUploadResponse

  if (!response.ok || !data.success || !data.url) {
    throw new Error(data.error ?? "Upload failed")
  }

  return { url: data.url }
}
