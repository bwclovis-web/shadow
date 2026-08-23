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
  status = 400,
  extras: Record<string, unknown> = {}
): Response => {
  if (error instanceof AppError) {
    return createAppErrorResponse(error, status)
  }
  return createJsonResponse({ success: false, error, ...extras }, status)
}

export const createSubscriptionRequiredResponse = (): Response =>
  createErrorResponse("Active membership required to participate", 403, {
    code: "subscription_required",
  })

export const createSuccessResponse = <T = Record<string, unknown>>(
  data?: T
): Response => createJsonResponse({ success: true, ...data })
