/**
 * Standardized Error Handling Patterns
 *
 * This module provides standardized patterns for error handling across the application.
 * Use these patterns consistently to ensure reliable error handling, logging, and user feedback.
 *
 * Note: For server-only patterns like withLoaderErrorHandling and withActionErrorHandling,
 * import from ~/utils/server/errorHandling.server instead.
 *
 * @module errorHandling.patterns
 */

import { AppError, createError, ErrorHandler } from "./errorHandling"

/**
 * Standard wrapper for database operations with automatic error handling
 *
 * @example
 * const user = await withDatabaseErrorHandling(
 *   async () => await db.user.findUnique({ where: { id } }),
 *   { operation: 'findUser', userId: id }
 * )
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw ErrorHandler.handle(error, {
      type: "database",
      ...context,
    })
  }
}

/**
 * Standard wrapper for API calls with automatic error handling
 *
 * @example
 * const data = await withApiErrorHandling(
 *   async () => await fetch('/api/endpoint').then(r => r.json()),
 *   { endpoint: '/api/endpoint', method: 'GET' }
 * )
 */
export async function withApiErrorHandling<T>(
  apiCall: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await apiCall()
  } catch (error) {
    throw ErrorHandler.handle(error, {
      type: "api",
      ...context,
    })
  }
}

/**
 * Standard wrapper for validation operations with automatic error handling
 *
 * @example
 * const validData = withValidationErrorHandling(
 *   () => validateSchema(data),
 *   { schema: 'userSchema', data }
 * )
 */
export function withValidationErrorHandling<T>(
  validation: () => T,
  context?: Record<string, any>
): T {
  try {
    return validation()
  } catch (error) {
    throw ErrorHandler.handle(error, {
      type: "validation",
      ...context,
    })
  }
}

/**
 * Standard error handler for authentication operations
 *
 * @example
 * try {
 *   await authenticateUser(credentials)
 * } catch (error) {
 *   throw handleAuthenticationError(error, { username: credentials.username })
 * }
 */
export function handleAuthenticationError(
  error: unknown,
  context?: Record<string, any>
): AppError {
  if (error instanceof AppError) {
    return error
  }

  // Convert to AppError with authentication type
  if (error instanceof Error) {
    return createError.authentication(error.message, context)
  }

  return createError.authentication(
    typeof error === "string" ? error : "Authentication failed",
    context
  )
}

/**
 * Standard error handler for authorization operations
 *
 * @example
 * try {
 *   checkUserPermission(userId, 'admin')
 * } catch (error) {
 *   throw handleAuthorizationError(error, { userId, requiredRole: 'admin' })
 * }
 */
export function handleAuthorizationError(
  error: unknown,
  context?: Record<string, any>
): AppError {
  if (error instanceof AppError) {
    return error
  }

  // Convert to AppError with authorization type
  if (error instanceof Error) {
    return createError.authorization(error.message, context)
  }

  return createError.authorization(
    typeof error === "string" ? error : "Access denied",
    context
  )
}

/**
 * Standard wrapper for async operations with result pattern (no throwing)
 * Returns [error, null] or [null, result]
 *
 * @example
 * const [error, user] = await safeAsync(() => getUser(id))
 * if (error) {
 *   // Handle error
 *   return
 * }
 * // Use user safely
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<[AppError, null] | [null, T]> {
  try {
    const result = await operation()
    return [null, result]
  } catch (error) {
    const appError = ErrorHandler.handle(error, context)
    return [appError, null]
  }
}

/**
 * Standard wrapper for sync operations with result pattern (no throwing)
 * Returns [error, null] or [null, result]
 *
 * @example
 * const [error, data] = safeSync(() => JSON.parse(jsonString))
 * if (error) {
 *   // Handle error
 *   return
 * }
 * // Use data safely
 */
export function safeSync<T>(
  operation: () => T,
  context?: Record<string, any>
): [AppError, null] | [null, T] {
  try {
    const result = operation()
    return [null, result]
  } catch (error) {
    const appError = ErrorHandler.handle(error, context)
    return [appError, null]
  }
}

/**
 * Standard retry wrapper with exponential backoff
 *
 * @example
 * const data = await withRetry(
 *   async () => await fetchData(),
 *   { maxRetries: 3, baseDelay: 1000, context: { operation: 'fetchData' } }
 * )
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    context?: Record<string, any>
    onRetry?: (attempt: number, error: AppError) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    context,
    onRetry,
  } = options

  let lastError: AppError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = ErrorHandler.handle(error, {
        attempt,
        maxRetries,
        ...context,
      })

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        onRetry?.(attempt + 1, lastError)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || createError.unknown("Retry failed", context)
}

/**
 * Create a standard "not found" error
 *
 * @example
 * const user = await getUser(id)
 * if (!user) {
 *   throw notFoundError('User', { userId: id })
 * }
 */
export function notFoundError(
  resourceName: string,
  context?: Record<string, any>
): AppError {
  return createError.notFound(resourceName, context)
}

/**
 * Create a standard validation error
 *
 * @example
 * if (!isValidEmail(email)) {
 *   throw validationError('Invalid email format', { email, field: 'email' })
 * }
 */
export function validationError(
  message: string,
  context?: Record<string, any>
): AppError {
  return createError.validation(message, context)
}

/**
 * Create a standard authentication error
 *
 * @example
 * if (!token) {
 *   throw authenticationError('No authentication token provided')
 * }
 */
export function authenticationError(
  message?: string,
  context?: Record<string, any>
): AppError {
  return createError.authentication(message, context)
}

/**
 * Create a standard authorization error
 *
 * @example
 * if (!hasPermission(user, 'admin')) {
 *   throw authorizationError('Admin permission required', { userId: user.id })
 * }
 */
export function authorizationError(
  message?: string,
  context?: Record<string, any>
): AppError {
  return createError.authorization(message, context)
}

/**
 * Create a standard database error
 *
 * @example
 * throw databaseError('Failed to connect to database', { host, port })
 */
export function databaseError(
  message?: string,
  context?: Record<string, any>
): AppError {
  return createError.database(message, context)
}

/**
 * Create a standard network error
 *
 * @example
 * throw networkError('Failed to fetch data', { url, timeout })
 */
export function networkError(
  message?: string,
  context?: Record<string, any>
): AppError {
  return createError.network(message, context)
}

/**
 * Helper to check if a value exists, throw notFoundError if not
 *
 * @example
 * const user = assertExists(
 *   await getUser(id),
 *   'User',
 *   { userId: id }
 * )
 */
export function assertExists<T>(
  value: T | null | undefined,
  resourceName: string,
  context?: Record<string, any>
): T {
  if (value === null || value === undefined) {
    throw notFoundError(resourceName, context)
  }
  return value
}

/**
 * Helper to validate a condition, throw validationError if false
 *
 * @example
 * assertValid(
 *   email.includes('@'),
 *   'Invalid email format',
 *   { email, field: 'email' }
 * )
 */
export function assertValid(
  condition: boolean,
  message: string,
  context?: Record<string, any>
): void {
  if (!condition) {
    throw validationError(message, context)
  }
}

/**
 * Helper to check authentication, throw authenticationError if not authenticated
 *
 * @example
 * assertAuthenticated(userId, { route: '/admin' })
 */
export function assertAuthenticated(
  userId: string | null | undefined,
  context?: Record<string, any>
): asserts userId is string {
  if (!userId) {
    throw authenticationError("Authentication required", context)
  }
}

/**
 * Helper to check authorization, throw authorizationError if not authorized
 *
 * @example
 * assertAuthorized(
 *   user.role === 'admin',
 *   'Admin access required',
 *   { userId: user.id, requiredRole: 'admin' }
 * )
 */
export function assertAuthorized(
  condition: boolean,
  message?: string,
  context?: Record<string, any>
): void {
  if (!condition) {
    throw authorizationError(message, context)
  }
}
