/** Public contact inbox for Organization JSON-LD and the site contact form. */

export const DEFAULT_SITE_CONTACT_EMAIL = "contact@perfumershollow.com"

export const getSiteContactEmail = (): string => {
  const fromEnv = process.env.CONTACT_INBOX_EMAIL?.trim()
  if (fromEnv) return fromEnv
  return DEFAULT_SITE_CONTACT_EMAIL
}
