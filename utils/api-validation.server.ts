/**
 * API validation middleware and utilities
 * Provides comprehensive validation for API endpoints
 */

import { z } from "zod"

import { createJsonResponse } from "@/utils/response.server"
import type { ValidationError } from "@/utils/validation"
import {
  validateData,
  validateFormData,
  validateJsonData,
  validateSearchParams,
} from "@/utils/validation"

// API validation middleware types
export interface ApiValidationOptions {
  body?: z.ZodSchema
  query?: z.ZodSchema
  params?: z.ZodSchema
  headers?: z.ZodSchema
  stripUnknown?: boolean
  abortEarly?: boolean
}

export interface ValidatedRequest<T = unknown> {
  body?: T
  query?: T
  params?: T
  headers?: T
}

// Validation error response
export const createValidationErrorResponse = (
  errors: ValidationError[],
  message = "Validation failed"
): Response => createJsonResponse({ success: false, error: message, errors }, 400)

// Generic API validation middleware
export const createApiValidationMiddleware = <T extends Record<string, unknown>>(
  options: ApiValidationOptions
) => {
  return async (request: Request): Promise<ValidatedRequest<T>> => {
    const validated: ValidatedRequest<T> = {}
    const errors: ValidationError[] = []

    try {
      // Validate request body
      if (options.body) {
        const contentType = request.headers.get("content-type")

        if (contentType?.includes("application/json")) {
          const bodyValidation = await validateJsonData(options.body, request, {
            stripUnknown: options.stripUnknown,
            abortEarly: options.abortEarly,
          })

          if (bodyValidation.success) {
            validated.body = bodyValidation.data
          } else {
            errors.push(...(bodyValidation.errors || []))
          }
        } else {
          const formData = await request.formData()
          const bodyValidation = validateFormData(options.body, formData, {
            stripUnknown: options.stripUnknown,
            abortEarly: options.abortEarly,
          })

          if (bodyValidation.success) {
            validated.body = bodyValidation.data
          } else {
            errors.push(...(bodyValidation.errors || []))
          }
        }
      }

      // Validate query parameters
      if (options.query) {
        const url = new URL(request.url)
        const queryValidation = validateSearchParams(
          options.query,
          url.searchParams,
          {
            stripUnknown: options.stripUnknown,
            abortEarly: options.abortEarly,
          }
        )

        if (queryValidation.success) {
          validated.query = queryValidation.data
        } else {
          errors.push(...(queryValidation.errors || []))
        }
      }

      // Validate URL parameters (if available)
      if (options.params) {
        // This would need to be passed from the route handler
        // For now, we'll skip this as it's route-specific
      }

      // Validate headers
      if (options.headers) {
        const headersData = Object.fromEntries(request.headers.entries())
        const headersValidation = validateData(options.headers, headersData, {
          stripUnknown: options.stripUnknown,
          abortEarly: options.abortEarly,
        })

        if (headersValidation.success) {
          validated.headers = headersValidation.data
        } else {
          errors.push(...(headersValidation.errors || []))
        }
      }

      if (errors.length > 0) {
        throw createJsonResponse(
          { success: false, error: "Validation failed", errors },
          400
        )
      }

      return validated
    } catch (error) {
      if (error instanceof Response) {
        throw error
      }
      console.error("API validation error:", error)
      throw createJsonResponse(
        { success: false, error: "Internal validation error" },
        500
      )
    }
  }
}

// Specific validation middleware for common patterns
export const validatePerfumeId = createApiValidationMiddleware({
  query: z.object({
    id: z.string().min(1, "Perfume ID is required"),
  }),
})

export const validateUserAction = createApiValidationMiddleware({
  body: z.object({
    action: z.enum(["add", "remove", "update"], {
      errorMap: () => ({ message: "Action must be add, remove, or update" }),
    }),
    perfumeId: z.string().min(1, "Perfume ID is required"),
  }),
})

export const validateRatingSubmission = createApiValidationMiddleware({
  body: z
    .object({
      perfumeId: z.string().min(1, "Perfume ID is required"),
      longevity: z.number().min(1).max(5).optional(),
      sillage: z.number().min(1).max(5).optional(),
      gender: z.number().min(1).max(5).optional(),
      priceValue: z.number().min(1).max(5).optional(),
      overall: z.number().min(1).max(5).optional(),
    })
    .refine(
      data => {
        const ratings = [
          data.longevity,
          data.sillage,
          data.gender,
          data.priceValue,
          data.overall,
        ]
        return ratings.some(rating => rating !== undefined)
      },
      {
        message: "At least one rating is required",
      }
    ),
})

export const validateCommentSubmission = createApiValidationMiddleware({
  body: z.object({
    perfumeId: z.string().min(1, "Perfume ID is required"),
    userPerfumeId: z.string().min(1, "User perfume ID is required"),
    comment: z
      .string()
      .min(1, "Comment is required")
      .max(1000, "Comment must be less than 1000 characters")
      .trim(),
    isPublic: z.boolean().optional(),
  }),
})

export const validateSearchQuery = createApiValidationMiddleware({
  query: z.object({
    q: z.string().max(100, "Search query too long").optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z
      .enum(["name", "price", "rating", "createdAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
})

// Pagination validation
export const validatePaginationParams = (searchParams: URLSearchParams) => {
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "10", 10)

  if (page < 1) {
    throw createJsonResponse(
      { success: false, error: "Page must be 1 or greater" },
      400
    )
  }
  if (limit < 1 || limit > 100) {
    throw createJsonResponse(
      { success: false, error: "Limit must be between 1 and 100" },
      400
    )
  }
  return { page, limit, offset: (page - 1) * limit }
}

// Authentication validation
export const validateAuthHeaders = (request: Request): string => {
  const authHeader = request.headers.get("authorization")
  if (!authHeader) {
    throw createJsonResponse(
      { success: false, error: "Authorization header is required" },
      401
    )
  }
  if (!authHeader.startsWith("Bearer ")) {
    throw createJsonResponse(
      { success: false, error: "Invalid authorization format" },
      401
    )
  }
  return authHeader.substring(7)
}

// Content-Type validation
export const validateContentType = (
  request: Request,
  expectedTypes: string[]
): string => {
  const contentType = request.headers.get("content-type")
  if (!contentType) {
    throw createJsonResponse(
      { success: false, error: "Content-Type header is required" },
      400
    )
  }
  const isValidType = expectedTypes.some(type => contentType.includes(type))
  if (!isValidType) {
    throw createJsonResponse(
      {
        success: false,
        error: `Content-Type must be one of: ${expectedTypes.join(", ")}`,
      },
      400
    )
  }
  return contentType
}

// Rate limiting validation (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export const validateRateLimit = (
  identifier: string,
  maxRequests = 100,
  windowMs = 15 * 60 * 1000 // 15 minutes
): void => {
  const now = Date.now()
  const current = rateLimitMap.get(identifier)

  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return
  }
  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000)
    throw createJsonResponse(
      {
        success: false,
        error: "Rate limit exceeded",
        retryAfter,
      },
      429,
      { "Retry-After": String(retryAfter) }
    )
  }
  current.count++
}

// CSRF validation - delegates to csrf.server (timing-safe)
export const validateCSRFOrThrow = async (
  request: Request,
  formData?: FormData
): Promise<void> => {
  const { requireCSRF } = await import("./server/csrf.server")
  await requireCSRF(request, formData)
}

// File upload validation
export const validateFileUpload = (
  file: File,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
  } = {}
): void => {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes = [],
    allowedExtensions = [],
  } = options

  if (file.size > maxSize) {
    throw createJsonResponse(
      {
        success: false,
        error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
      },
      400
    )
  }
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw createJsonResponse(
      {
        success: false,
        error: `File type must be one of: ${allowedTypes.join(", ")}`,
      },
      400
    )
  }
  if (allowedExtensions.length > 0) {
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      throw createJsonResponse(
        {
          success: false,
          error: `File extension must be one of: ${allowedExtensions.join(", ")}`,
        },
        400
      )
    }
  }
}

// Export common validation schemas for reuse
export const commonApiSchemas = {
  id: z.string().min(1, "ID is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  url: z.string().url("Invalid URL format"),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, "Invalid phone number"),
  year: z.string().regex(/^(19|20)\d{2}$/, "Invalid year format"),
  rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  pagination: z.object({
    page: z.number().min(1, "Page must be 1 or greater"),
    limit: z.number().min(1).max(100, "Limit must be between 1 and 100"),
  }),
} as const
