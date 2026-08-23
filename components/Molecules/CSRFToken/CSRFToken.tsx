"use client"

import { useContext } from "react"

import { useCSRF } from "@/hooks/useCSRF"

import { CSRFTokenContext } from "./CSRFTokenProvider"

interface CSRFTokenProps {
  name?: string
}

export const CSRFToken = ({ name = "_csrf" }: CSRFTokenProps) => {
  const fromProvider = useContext(CSRFTokenContext)
  const local = useCSRF()
  const csrfToken = fromProvider?.csrfToken ?? local.csrfToken
  const isLoading = fromProvider?.isLoading ?? local.isLoading

  if (isLoading || !csrfToken) {
    return null
  }

  return <input type="hidden" name={name} value={csrfToken} />
}
