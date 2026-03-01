/**
 * Reusable utilities for Next.js API route handlers (App Router).
 * Reduces boilerplate and ensures consistency across route handlers.
 */

import type { NextRequest } from "next/server"

import { authenticateUser } from "@/utils/server/auth.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { createErrorResponse, createSuccessResponse } from "@/utils/response.server"

// ==================== Types ====================

export interface AuthenticatedContext {
  userId: string
  user: {
    id: string
    email: string
    role: string
  }
}

/** Context passed to authenticated Next.js API handlers */
export interface AuthenticatedApiContext {
  auth: AuthenticatedContext
}

/** Handler for authenticated GET/POST etc. Receives request and auth, returns Response or JSON-serializable data */
export type AuthenticatedApiHandler<T = unknown> = (
  request: NextRequest | Request,
  context: AuthenticatedApiContext
) => Promise<Response | T>

// ==================== Query Parameter Helpers ====================

/**
 * Safely parse query parameters from URL (works with Request or NextRequest)
 */
export const parseQueryParams = (request: Request) => {
  const url = new URL(request.url)

  return {
    get: (key: string): string | null => url.searchParams.get(key),

    getString: (key: string, defaultValue = ""): string =>
      url.searchParams.get(key) ?? defaultValue,

    getInt: (key: string, defaultValue = 0): number => {
      const value = url.searchParams.get(key)
      if (!value) return defaultValue
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? defaultValue : parsed
    },

    getBoolean: (key: string, defaultValue = false): boolean => {
      const value = url.searchParams.get(key)
      if (value === null) return defaultValue
      return value === "true" || value === "1"
    },

    getAll: (key: string): string[] => url.searchParams.getAll(key),

    required: (key: string): string => {
      const value = url.searchParams.get(key)
      if (!value) throw new Error(`Required query parameter "${key}" is missing`)
      return value
    },
  }
}

/**
 * Parse pagination parameters with defaults
 */
export const parsePaginationParams = (request: Request) => {
  const params = parseQueryParams(request)
  return {
    page: params.getInt("page", 1),
    limit: params.getInt("limit", 10),
    skip: params.getInt("skip", 0),
    take: params.getInt("take", 10),
  }
}

// ==================== FormData Helpers ====================

/**
 * Safely parse form data from request body
 */
export const parseFormData = async (request: Request) => {
  const formData = await request.formData()

  return {
    get: (key: string): string | null => {
      const value = formData.get(key)
      return typeof value === "string" ? value : null
    },

    getString: (key: string, defaultValue = ""): string => {
      const value = formData.get(key)
      return typeof value === "string" ? value : defaultValue
    },

    getInt: (key: string, defaultValue = 0): number => {
      const value = formData.get(key)
      if (typeof value !== "string") return defaultValue
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? defaultValue : parsed
    },

    getBoolean: (key: string, defaultValue = false): boolean => {
      const value = formData.get(key)
      if (typeof value !== "string") return defaultValue
      return value === "true" || value === "1"
    },

    required: (key: string): string => {
      const value = formData.get(key)
      if (typeof value !== "string" || !value) {
        throw new Error(`Required form field "${key}" is missing`)
      }
      return value
    },
  }
}

// ==================== Authentication Wrappers (Next.js) ====================

/**
 * Wrapper for Next.js route handlers that require authentication.
 * Use for GET/POST etc. that need a logged-in user.
 *
 * @example
 * ```ts
 * export const GET = withAuthenticatedApiHandler(async (request, { auth }) => {
 *   const data = await getData(auth.userId)
 *   return createSuccessResponse(data)
 * })
 * ```
 */
export const withAuthenticatedApiHandler = <T = unknown>(
  handler: AuthenticatedApiHandler<T>,
  options: { context?: Record<string, unknown> } = {}
) => {
  return async (request: NextRequest | Request): Promise<Response> => {
    try {
      const authResult = await authenticateUser(request)

      if (!authResult.success) {
        return createErrorResponse(
          authResult.error ?? "Unauthorized",
          authResult.status ?? 401
        )
      }

      const auth: AuthenticatedContext = {
        userId: authResult.user!.id,
        user: authResult.user!,
      }

      const result = await handler(request, { auth })

      if (result instanceof Response) return result
      return createSuccessResponse(result as Record<string, unknown>)
    } catch (error) {
      const appError = ErrorHandler.handle(error, {
        ...options.context,
        route: "api",
      })
      return createErrorResponse(appError.userMessage, 500)
    }
  }
}

// ==================== Validation Helpers ====================

/** Validate rating value (1–5) */
export const validateRating = (rating: number): void => {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5")
  }
}

/** Validate rating category for perfume ratings */
export const validateRatingCategory = (category: string): void => {
  const validCategories = [
    "longevity",
    "sillage",
    "gender",
    "priceValue",
    "overall",
  ]
  if (!validCategories.includes(category)) {
    throw new Error(
      `Invalid rating category. Must be one of: ${validCategories.join(", ")}`
    )
  }
}

/** Validate that required fields are present (truthy) */
export const validateRequiredFields = (
  fields: Record<string, unknown>,
  fieldNames: string[]
): void => {
  const missing = fieldNames.filter((name) => !fields[name])
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`)
  }
}

// ==================== Response Helpers ====================

/** Create a paginated JSON response with metadata */
export const createPaginatedResponse = (
  data: unknown[],
  pagination: { page: number; limit: number; totalCount: number }
) => {
  const { page, limit, totalCount } = pagination
  const totalPages = Math.ceil(totalCount / limit)
  return createSuccessResponse({
    data,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  })
}
