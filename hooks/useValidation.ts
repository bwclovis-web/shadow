/**
 * Comprehensive form validation hook
 * Provides real-time validation, error handling, and form state management
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ZodError, ZodSchema } from "zod"
import { z } from "zod"

// Validation hook types
export interface UseValidationOptions<T> {
  schema: ZodSchema<T>
  initialValues: T
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnSubmit?: boolean
  debounceMs?: number
  transform?: (data: T) => T
}

export interface UseValidationReturn<T> {
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
  handleSubmit: (
    onSubmit: (data: T) => Promise<void> | void
  ) => (e?: React.FormEvent) => Promise<void>
  reset: () => void
  resetToValues: (values: T) => void
}

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Comprehensive form validation hook
 */
export function useValidation<T extends Record<string, unknown>>({
  schema,
  initialValues,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
  debounceMs = 300,
  transform,
}: UseValidationOptions<T>): UseValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<keyof T, string>>({} as Record<keyof T, string>)
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  // Debounced values for validation
  const debouncedValues = useDebounce(values, debounceMs)

  // Check if form is dirty
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues]
  )

  // Check if form is valid
  const isValid = useMemo(
    () => Object.keys(errors).length === 0 &&
      Object.values(values).every(value => value !== null && value !== undefined && value !== ""),
    [errors, values]
  )

  // Validate a single field
  const validateField = useCallback(
    async <K extends keyof T>(field: K): Promise<boolean> => {
      try {
        setIsValidating(true)

        // Create a partial schema for the field
        const fieldSchema = schema.pick({ [field]: true } as any)
        const fieldData = { [field]: values[field] } as Pick<T, K>

        // Transform data if transform function is provided
        const dataToValidate = transform ? transform(fieldData as T) : fieldData

        await fieldSchema.parseAsync(dataToValidate)

        // Clear error for this field
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })

        return true
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.errors.find(err => err.path[0] === field)
          if (fieldError) {
            setErrors(prev => ({
              ...prev,
              [field]: fieldError.message,
            }))
          }
        }
        return false
      } finally {
        setIsValidating(false)
      }
    },
    [schema, values, transform]
  )

  // Validate entire form
  const validate = useCallback(async (): Promise<boolean> => {
    try {
      setIsValidating(true)

      // Transform data if transform function is provided
      const dataToValidate = transform ? transform(values) : values

      await schema.parseAsync(dataToValidate)

      // Clear all errors
      setErrors({} as Record<keyof T, string>)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors = {} as Record<keyof T, string>

        error.errors.forEach(err => {
          const field = err.path[0] as keyof T
          if (field) {
            newErrors[field] = err.message
          }
        })

        setErrors(newErrors)
      }
      return false
    } finally {
      setIsValidating(false)
    }
  }, [schema, values, transform])

  // Set individual field value
  const setValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues(prev => ({
        ...prev,
        [field]: value,
      }))

      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[field]
          return newErrors
        })
      }
    },
    [errors]
  )

  // Set multiple field values
  const setValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({
      ...prev,
      ...newValues,
    }))
  }, [])

  // Set individual field error
  const setError = useCallback(<K extends keyof T>(field: K, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }))
  }, [])

  // Set multiple field errors
  const setErrors = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrors(prev => ({
      ...prev,
      ...newErrors,
    }))
  }, [])

  // Clear individual field error
  const clearError = useCallback(<K extends keyof T>(field: K) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({} as Record<keyof T, string>)
  }, [])

  // Set individual field touched state
  const setTouched = useCallback(<K extends keyof T>(field: K, touched: boolean) => {
    setTouched(prev => ({
      ...prev,
      [field]: touched,
    }))
  }, [])

  // Set all fields touched state
  const setAllTouched = useCallback(
    (touched: boolean) => {
      const newTouched = {} as Record<keyof T, boolean>
      Object.keys(values).forEach(key => {
        newTouched[key as keyof T] = touched
      })
      setTouched(newTouched)
    },
    [values]
  )

  // Handle field change
  const handleChange = useCallback(
    <K extends keyof T>(field: K) => (value: T[K]) => {
        setValue(field, value)
      },
    [setValue]
  )

  // Handle field blur
  const handleBlur = useCallback(
    <K extends keyof T>(field: K) => () => {
        setTouched(field, true)

        if (validateOnBlur) {
          validateField(field)
        }
      },
    [validateOnBlur, validateField, setTouched]
  )

  // Handle form submission
  const handleSubmit = useCallback(
    (onSubmit: (data: T) => Promise<void> | void) => async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault()
      }

      // Mark all fields as touched
      setAllTouched(true)

      // Validate form if validation on submit is enabled
      if (validateOnSubmit) {
        const isValid = await validate()
        if (!isValid) {
          return
        }
      }

      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } catch (error) {
        console.error("Form submission error:", error)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
validateOnSubmit, validate, values, setAllTouched
]
  )

  // Reset form to initial values
  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({} as Record<keyof T, string>)
    setTouched({} as Record<keyof T, boolean>)
    setIsSubmitting(false)
  }, [initialValues])

  // Reset form to specific values
  const resetToValues = useCallback((newValues: T) => {
    setValues(newValues)
    setErrors({} as Record<keyof T, string>)
    setTouched({} as Record<keyof T, boolean>)
    setIsSubmitting(false)
  }, [])

  // Validate on change if enabled
  useEffect(() => {
    if (validateOnChange && isDirty) {
      const timeoutId = setTimeout(() => {
        validate()
      }, debounceMs)

      return () => clearTimeout(timeoutId)
    }
  }, [
debouncedValues, validateOnChange, isDirty, validate, debounceMs
])

  // Update values when initialValues change
  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    isSubmitting,
    isValidating,
    setValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    setTouched,
    setAllTouched,
    validate,
    validateField,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    resetToValues,
  }
}

/**
 * Hook for validating individual fields
 */
export function useFieldValidation<T, K extends keyof T>(
  schema: ZodSchema<T>,
  field: K,
  value: T[K],
  options: {
    validateOnChange?: boolean
    debounceMs?: number
  } = {}
) {
  const [error, setError] = useState<string>("")
  const [isValidating, setIsValidating] = useState(false)

  const debouncedValue = useDebounce(value, options.debounceMs || 300)

  const validateField = useCallback(async () => {
    try {
      setIsValidating(true)

      // Create a partial schema for the field
      const fieldSchema = schema.pick({ [field]: true } as any)
      const fieldData = { [field]: debouncedValue } as Pick<T, K>

      await fieldSchema.parseAsync(fieldData)
      setError("")
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(err => err.path[0] === field)
        if (fieldError) {
          setError(fieldError.message)
        }
      }
      return false
    } finally {
      setIsValidating(false)
    }
  }, [schema, field, debouncedValue])

  useEffect(() => {
    if (options.validateOnChange !== false) {
      validateField()
    }
  }, [validateField, options.validateOnChange])

  return {
    error,
    isValidating,
    validate: validateField,
  }
}

/**
 * Hook for validating form data before submission
 */
export function useFormValidation<T>(
  schema: ZodSchema<T>,
  data: T,
  options: {
    validateOnMount?: boolean
    validateOnChange?: boolean
    debounceMs?: number
  } = {}
) {
  const [errors, setErrors] = useState<Record<keyof T, string>>({} as Record<keyof T, string>)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState(false)

  const debouncedData = useDebounce(data, options.debounceMs || 300)

  const validate = useCallback(async () => {
    try {
      setIsValidating(true)
      await schema.parseAsync(debouncedData)
      setErrors({} as Record<keyof T, string>)
      setIsValid(true)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors = {} as Record<keyof T, string>

        error.errors.forEach(err => {
          const field = err.path[0] as keyof T
          if (field) {
            newErrors[field] = err.message
          }
        })

        setErrors(newErrors)
        setIsValid(false)
      }
      return false
    } finally {
      setIsValidating(false)
    }
  }, [schema, debouncedData])

  useEffect(() => {
    if (options.validateOnMount || options.validateOnChange !== false) {
      validate()
    }
  }, [validate, options.validateOnMount, options.validateOnChange])

  return {
    errors,
    isValidating,
    isValid,
    validate,
  }
}
