"use client"

import { useEffect } from "react"
import { useFormStatus } from "react-dom"

const FormPendingSync = ({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void
}) => {
  const { pending } = useFormStatus()
  useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  return null
}

export default FormPendingSync
