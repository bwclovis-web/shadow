const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "no-vapid" | "no-sw" | "error"; message?: string }

export const subscribeToWebPush = async (
  vapidPublicKey: string,
  csrfHeaders: HeadersInit
): Promise<PushSubscribeResult> => {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" }
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" }
  }
  if (!vapidPublicKey) {
    return { ok: false, reason: "no-vapid" }
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    return { ok: false, reason: "denied" }
  }

  const registration = await navigator.serviceWorker.ready
  if (!registration.pushManager) {
    return { ok: false, reason: "unsupported" }
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "error", message: "Invalid subscription keys" }
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeaders,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    return {
      ok: false,
      reason: "error",
      message: data.error ?? "Failed to save subscription",
    }
  }

  return { ok: true }
}

export const unsubscribeFromWebPush = async (
  csrfHeaders: HeadersInit
): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager?.getSubscription()
  if (!subscription) return true

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeaders,
    },
    body: JSON.stringify({ endpoint }),
  })

  return true
}

export const fetchVapidPublicKey = async (): Promise<string | null> => {
  const response = await fetch("/api/push/vapid-public-key", { credentials: "include" })
  if (!response.ok) return null
  const data = (await response.json()) as { publicKey?: string }
  return data.publicKey ?? null
}
