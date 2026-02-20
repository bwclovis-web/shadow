/**
 * Comprehensive validated form component
 * Integrates with the validation system and provides form state management
 */

import React, { useCallback, useEffect } from "react"
import type { ZodSchema } from "zod"

import { useValidation } from "~/hooks/useValidation"

export interface ValidatedFormProps<T extends Record<string, unknown>> {
  schema: ZodSchema<T>
  initialValues: T
  onSubmit: (data: T) => Promise<void> | void
  onReset?: () => void
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnSubmit?: boolean
  debounceMs?: number
  transform?: (data: T) => T
  className?: string
  children: (form: {
    values: T
    errors: Record<keyof T, string>
    touched: Record<keyof T, boolean>
    isValid: boolean
    isDirty: boolean
    isSubmitting: boolean
    isValidating: boolean
    setValue: <K extends keyof T>(field: K, value: T[K]) => void
    setValues: (values: Partial<T>) => void
    setError: <K extends keyof T>(field: K, error: string) => void
    setErrors: (errors: Partial<Record<keyof T, string>>) => void
    clearError: <K extends keyof T>(field: K) => void
    clearErrors: () => void
    setTouched: <K extends keyof T>(field: K, touched: boolean) => void
    setAllTouched: (touched: boolean) => void
    validate: () => Promise<boolean>
    validateField: <K extends keyof T>(field: K) => Promise<boolean>
    handleChange: <K extends keyof T>(field: K) => (value: T[K]) => void
    handleBlur: <K extends keyof T>(field: K) => () => void
    handleSubmit: (e?: React.FormEvent) => Promise<void>
    reset: () => void
    resetToValues: (values: T) => void
  }) => React.ReactNode
}

function ValidatedForm<T extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  onReset,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
  debounceMs = 300,
  transform,
  className = "",
  children,
}: ValidatedFormProps<T>) {
  const form = useValidation({
    schema,
    initialValues,
    validateOnChange,
    validateOnBlur,
    validateOnSubmit,
    debounceMs,
    transform,
  })

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault()
      }

      // Mark all fields as touched
      form.setAllTouched(true)

      // Validate form if validation on submit is enabled
      if (validateOnSubmit) {
        const isValid = await form.validate()
        if (!isValid) {
          return
        }
      }

      form.setSubmitting(true)
      try {
        await onSubmit(form.values)
        if (onReset) {
          onReset()
        }
      } catch (error) {
        console.error("Form submission error:", error)
      } finally {
        form.setSubmitting(false)
      }
    },
    [
form, validateOnSubmit, onSubmit, onReset
]
  )

  return (
    <form className={`space-y-6 ${className}`} onSubmit={handleSubmit} noValidate>
      {children({
        values: form.values,
        errors: form.errors,
        touched: form.touched,
        isValid: form.isValid,
        isDirty: form.isDirty,
        isSubmitting: form.isSubmitting,
        isValidating: form.isValidating,
        setValue: form.setValue,
        setValues: form.setValues,
        setError: form.setError,
        setErrors: form.setErrors,
        clearError: form.clearError,
        clearErrors: form.clearErrors,
        setTouched: form.setTouched,
        setAllTouched: form.setAllTouched,
        validate: form.validate,
        validateField: form.validateField,
        handleChange: form.handleChange,
        handleBlur: form.handleBlur,
        handleSubmit,
        reset: form.reset,
        resetToValues: form.resetToValues,
      })}
    </form>
  )
}

export default ValidatedForm
