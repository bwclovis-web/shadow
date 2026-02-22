import { useEffect, useState } from "react"

const CSRF_COOKIE_PREFIX = "_csrf="

const getCSRFFromCookie = (): string | null => {
  const csrfCookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(CSRF_COOKIE_PREFIX))
  if (!csrfCookie) return null
  const token = csrfCookie.split("=")[1]?.trim()
  return token || null
}

/**
 * Hook to manage CSRF tokens in React components.
 * Automatically fetches and manages CSRF tokens for form submissions.
 */
export const useCSRF = () => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getCSRFFromCookie()
    if (token) setCsrfToken(token)
    setIsLoading(false)
  }, [])

  const getToken = (): string | null => csrfToken

  const getTokenWithFallback = (): string | null =>
    csrfToken ?? getCSRFFromCookie()

  const addToFormData = (formData: FormData): FormData => {
    const token = getTokenWithFallback()
    if (token) formData.append("_csrf", token)
    return formData
  }

  const addToHeaders = (headers: HeadersInit = {}): HeadersInit => {
    const token = getTokenWithFallback()
    if (!token) return headers
    return { ...headers, "x-csrf-token": token }
  }

  const submitForm = async (
    url: string,
    formData: FormData,
    options: RequestInit = {}
  ): Promise<Response> =>
    fetch(url, {
      ...options,
      method: "POST",
      body: addToFormData(formData),
      headers: addToHeaders(options.headers),
      credentials: "include",
    })

  const prepareApiRequest = (
    formData: FormData
  ): { formData: FormData; headers: HeadersInit } => {
    const token = getTokenWithFallback()
    if (token) formData.set("_csrf", token)
    return {
      formData,
      headers: token ? { "x-csrf-token": token } : {},
    }
  }

  return {
    csrfToken,
    isLoading,
    getToken,
    getTokenWithFallback,
    addToFormData,
    addToHeaders,
    submitForm,
    prepareApiRequest,
  }
}
