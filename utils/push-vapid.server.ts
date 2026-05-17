import webpush from "web-push"

let vapidConfigured = false
let missingConfigWarned = false

export const getVapidPublicKey = (): string | null =>
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
  process.env.VAPID_PUBLIC_KEY?.trim() ||
  null

const getVapidPrivateKey = (): string | null =>
  process.env.VAPID_PRIVATE_KEY?.trim() || null

const getVapidSubject = (): string | null => {
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!subject) return null
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) return subject
  if (subject.includes("@")) return `mailto:${subject.replace(/^.*<([^>]+)>.*$/, "$1").trim() || subject}`
  return `https://${subject.replace(/^https?:\/\//, "")}`
}

export const isPushConfigured = (): boolean =>
  Boolean(getVapidPublicKey() && getVapidPrivateKey() && getVapidSubject())

export const ensureVapidConfigured = (): boolean => {
  if (vapidConfigured) return true

  const publicKey = getVapidPublicKey()
  const privateKey = getVapidPrivateKey()
  const subject = getVapidSubject()

  if (!publicKey || !privateKey || !subject) {
    if (!missingConfigWarned && process.env.NODE_ENV !== "test") {
      missingConfigWarned = true
      console.warn(
        "[push] VAPID keys not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT); web push disabled"
      )
    }
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}
