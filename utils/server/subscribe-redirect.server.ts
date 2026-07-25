const DEFAULT_REDIRECT = "/sign-up"

/** Same-origin relative path only; blocks open redirects. */
export const sanitizeRedirectPath = (
  redirectPath: string | null | undefined
): string => {
  if (
    !redirectPath ||
    !redirectPath.startsWith("/") ||
    redirectPath.startsWith("//")
  ) {
    return DEFAULT_REDIRECT
  }
  return redirectPath
}
