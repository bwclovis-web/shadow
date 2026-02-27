/**
 * CSRF validation for server-side requests.
 * Implement timing-safe token verification when ready.
 */

export const requireCSRF = async (
  _request: Request,
  _formData?: FormData
): Promise<void> => {
  // TODO: Add timing-safe CSRF token verification when needed
}
