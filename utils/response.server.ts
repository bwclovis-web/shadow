import {
  AppError,
  createErrorResponse as createAppErrorResponse,
} from "./errorHandling"

export const createJsonResponse = <T = unknown>(
  data: T,
  status = 200,
  headers: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })

export const createErrorResponse = (
  error: string | AppError,
  status = 400
): Response => {
  if (error instanceof AppError) {
    return createAppErrorResponse(error, status)
  }
  return createJsonResponse({ success: false, error }, status)
}

export const createSuccessResponse = <T = Record<string, unknown>>(
  data?: T
): Response => createJsonResponse({ success: true, ...data })
