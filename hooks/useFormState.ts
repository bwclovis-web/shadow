import { useEffect, useState } from "react"

export interface UseFormStateOptions<T> {
  initialValues: T
  validate?: (values: T) => Partial<Record<keyof T, string>>
  onSubmit?: (values: T) => void | Promise<void>
  resetOnSubmit?: boolean
}

export interface UseFormStateReturn<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  isSubmitting: boolean
  isValid: boolean
  isDirty: boolean
  setValue: <K extends keyof T>(field: K, value: T[K]) => void
  setValues: (values: Partial<T>) => void
  setError: <K extends keyof T>(field: K, error: string) => void
  setErrors: (errors: Partial<Record<keyof T, string>>) => void
  clearError: <K extends keyof T>(field: K) => void
  clearErrors: () => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  reset: () => void
  validate: () => boolean
}

/**
 * Custom hook for managing form state with validation
 *
 * @param options - Configuration options for the form
 * @returns Form state and handlers
 */
export const useFormState = <T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
  resetOnSubmit = false,
}: UseFormStateOptions<T>): UseFormStateReturn<T> => {
  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrorsState] = useState<Partial<Record<keyof T, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Check if form is valid
  const isValid = Object.keys(errors).length === 0

  // Set individual field value
  const setValue = <K extends keyof T>(field: K, value: T[K]) => {
    setValuesState(prev => {
      const newValues = { ...prev, [field]: value }
      setIsDirty(true)
      return newValues
    })

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrorsState(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Set multiple field values
  const setValues = (newValues: Partial<T>) => {
    setValuesState(prev => {
      const updated = { ...prev, ...newValues }
      setIsDirty(true)
      return updated
    })
  }

  // Set individual field error
  const setError = <K extends keyof T>(field: K, error: string) => {
    setErrorsState(prev => ({
      ...prev,
      [field]: error,
    }))
  }

  // Set multiple field errors
  const setErrors = (newErrors: Partial<Record<keyof T, string>>) => {
    setErrorsState(prev => ({
      ...prev,
      ...newErrors,
    }))
  }

  // Clear individual field error
  const clearError = <K extends keyof T>(field: K) => {
    setErrorsState(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }

  // Clear all errors
  const clearErrors = () => {
    setErrorsState({})
  }

  // Validate form
  const validateForm = (): boolean => {
    if (!validate) {
      return true
    }

    const validationErrors = validate(values)
    const hasErrors = Object.keys(validationErrors).length > 0

    if (hasErrors) {
      setErrors(validationErrors)
      return false
    }

    clearErrors()
    return true
  }

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!validateForm()) {
      return
    }

    if (!onSubmit) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values)
      if (resetOnSubmit) {
        reset()
      }
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form to initial values
  const reset = () => {
    setValuesState(initialValues)
    setErrorsState({})
    setIsDirty(false)
    setIsSubmitting(false)
  }

  // Update values when initialValues change
  useEffect(() => {
    setValuesState(initialValues)
    setIsDirty(false)
  }, [initialValues])

  return {
    values,
    errors,
    isSubmitting,
    isValid,
    isDirty,
    setValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    handleSubmit,
    reset,
    validate: validateForm,
  }
}

export default useFormState
