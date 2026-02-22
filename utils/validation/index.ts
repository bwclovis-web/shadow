/**
 * Comprehensive validation utilities
 * Centralized validation system for forms, API endpoints, and data operations
 */

import type { ZodError, ZodSchema } from "zod"
import { z } from "zod"

// Re-export all schemas for convenience
export * from "./schemas"

// Validation result types
export interface ValidationResult<T = unknown> {
  success: boolean
  data?: T
  errors?: ValidationError[]
  error?: string
}

export interface ValidationError {
  field: string
  message: string
  code?: string
  value?: unknown
}

// Validation options
export interface ValidationOptions {
  stripUnknown?: boolean
  abortEarly?: boolean
  allowUnknown?: boolean
}

// Default validation options
const defaultOptions: ValidationOptions = {
  stripUnknown: true,
  abortEarly: false,
  allowUnknown: false,
}

/**
 * Validate data against a Zod schema
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const opts = { ...defaultOptions, ...options }

  try {
    const result = schema.parse(data, {
      stripUnknown: opts.stripUnknown,
      abortEarly: opts.abortEarly,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      }
    }

    return {
      success: false,
      error: "Validation failed with unknown error",
    }
  }
}

/**
 * Validate form data from a request
 */
export function validateFormData<T>(
  schema: ZodSchema<T>,
  formData: FormData,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const data = Object.fromEntries(formData.entries())
  return validateData(schema, data, options)
}

/**
 * Validate JSON data from a request
 */
export async function validateJsonData<T>(
  schema: ZodSchema<T>,
  request: Request,
  options: ValidationOptions = {}
): Promise<ValidationResult<T>> {
  try {
    const data = await request.json()
    return validateData(schema, data, options)
  } catch (error) {
    return {
      success: false,
      error: "Invalid JSON data",
    }
  }
}

/**
 * Validate URL search parameters
 */
export function validateSearchParams<T>(
  schema: ZodSchema<T>,
  searchParams: URLSearchParams,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const data = Object.fromEntries(searchParams.entries())
  return validateData(schema, data, options)
}

/**
 * Format Zod errors into a consistent format
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
    value: err.input,
  }))
}

/**
 * Validate and transform data with error handling
 */
export function validateAndTransform<T, R>(
  schema: ZodSchema<T>,
  data: unknown,
  transform: (validData: T) => R,
  options: ValidationOptions = {}
): ValidationResult<R> {
  const validation = validateData(schema, data, options)

  if (!validation.success) {
    return validation
  }

  try {
    const transformed = transform(validation.data!)
    return {
      success: true,
      data: transformed,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transformation failed",
    }
  }
}

/**
 * Validate multiple fields individually
 */
export function validateFields<T extends Record<string, unknown>>(
  validators: Record<keyof T, ZodSchema>,
  data: T
): ValidationResult<T> {
  const errors: ValidationError[] = []
  const validatedData = {} as T

  for (const [field, schema] of Object.entries(validators)) {
    const result = validateData(schema, data[field])

    if (result.success) {
      validatedData[field as keyof T] = result.data!
    } else {
      errors.push(...(result.errors || []))
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    }
  }

  return {
    success: true,
    data: validatedData,
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
}

/**
 * Sanitize object with string properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key as keyof T] = sanitizeString(value) as T[keyof T]
    } else if (typeof value === "object" && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value as Record<string, unknown>) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}

/**
 * Validate and sanitize data
 */
export function validateAndSanitize<T>(
  schema: ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const sanitizedData =
    typeof data === "object" && data !== null
      ? sanitizeObject(data as Record<string, unknown>)
      : data

  return validateData(schema, sanitizedData, options)
}

/**
 * Create a validation middleware for API routes
 */
export function createValidationMiddleware<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return async (request: Request) => {
    const contentType = request.headers.get("content-type")

    let validation: ValidationResult<T>

    if (contentType?.includes("application/json")) {
      validation = await validateJsonData(schema, request, options)
    } else {
      const formData = await request.formData()
      validation = validateFormData(schema, formData, options)
    }

    if (!validation.success) {
      throw new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          errors: validation.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return validation.data!
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "10", 10)

  if (page < 1) {
    throw new Error("Page must be 1 or greater")
  }

  if (limit < 1 || limit > 100) {
    throw new Error("Limit must be between 1 and 100")
  }

  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Validate ID parameter
 */
export function validateId(id: string | null, fieldName = "ID"): string {
  if (!id || id.trim() === "") {
    throw new Error(`${fieldName} is required`)
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
    throw new Error(`${fieldName} contains invalid characters`)
  }

  return id.trim()
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format")
  }

  return email.toLowerCase().trim()
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long")
  }

  if (password.length > 128) {
    throw new Error("Password must be less than 128 characters")
  }

  if (!/[a-z]/.test(password)) {
    throw new Error("Password must contain at least one lowercase letter")
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter")
  }

  if (!/[0-9]/.test(password)) {
    throw new Error("Password must contain at least one number")
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    throw new Error("Password must contain at least one special character")
  }

  if (password.includes(" ")) {
    throw new Error("Password cannot contain spaces")
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.toString()
  } catch {
    throw new Error("Invalid URL format")
  }
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): string {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/

  if (!phoneRegex.test(phone)) {
    throw new Error("Invalid phone number format")
  }

  return phone.trim()
}

/**
 * Validate year format
 */
export function validateYear(year: string): number {
  const yearNum = parseInt(year, 10)

  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2099) {
    throw new Error("Year must be between 1900 and 2099")
  }

  return yearNum
}

/**
 * Validate rating value (1-5)
 */
export function validateRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5")
  }

  return rating
}

/**
 * Validate amount/price format
 */
export function validateAmount(amount: string): number {
  const amountNum = parseFloat(amount)

  if (isNaN(amountNum) || amountNum < 0) {
    throw new Error("Amount must be a positive number")
  }

  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Amount must have at most 2 decimal places")
  }

  return amountNum
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName = "Value"
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(", ")}`)
  }

  return value as T
}

/**
 * Validate array of values
 */
export function validateArray<T>(
  values: unknown[],
  validator: (value: unknown) => T,
  fieldName = "Array"
): T[] {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} must be an array`)
  }

  const validatedValues: T[] = []

  for (let i = 0; i < values.length; i++) {
    try {
      validatedValues.push(validator(values[i]))
    } catch (error) {
      throw new Error(`${fieldName}[${i}]: ${
          error instanceof Error ? error.message : "Invalid value"
        }`)
    }
  }

  return validatedValues
}

/**
 * Validate object properties
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: unknown,
  validators: Record<keyof T, (value: unknown) => T[keyof T]>,
  fieldName = "Object"
): T {
  if (typeof obj !== "object" || obj === null) {
    throw new Error(`${fieldName} must be an object`)
  }

  const validatedObj = {} as T

  for (const [key, validator] of Object.entries(validators)) {
    try {
      validatedObj[key as keyof T] = validator((obj as Record<string, unknown>)[key])
    } catch (error) {
      throw new Error(`${fieldName}.${key}: ${
          error instanceof Error ? error.message : "Invalid value"
        }`)
    }
  }

  return validatedObj
}
