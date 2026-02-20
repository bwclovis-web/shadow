import { createContext, type ReactNode, useContext } from "react"

import { useCSRF } from "~/hooks/useCSRF"

interface CSRFTokenContextType {
  csrfToken: string | null
  isLoading: boolean
  addToFormData: (formData: FormData) => FormData
  addToHeaders: (headers?: HeadersInit) => HeadersInit
  submitForm: (
    url: string,
    formData: FormData,
    options?: RequestInit
  ) => Promise<Response>
}

const CSRFTokenContext = createContext<CSRFTokenContextType | null>(null)

interface CSRFTokenProviderProps {
  children: ReactNode
}

export const CSRFTokenProvider = ({ children }: CSRFTokenProviderProps) => {
  const csrf = useCSRF()

  return (
    <CSRFTokenContext.Provider value={csrf}>{children}</CSRFTokenContext.Provider>
  )
}

export const useCSRFToken = () => {
  const context = useContext(CSRFTokenContext)
  if (!context) {
    throw new Error("useCSRFToken must be used within a CSRFTokenProvider")
  }
  return context
}
