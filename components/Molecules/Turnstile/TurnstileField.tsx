"use client"

import { useEffect, useId, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string
          theme?: "dark" | "light" | "auto"
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    __turnstileScriptLoading?: Promise<void>
  }
}

const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (window.__turnstileScriptLoading) return window.__turnstileScriptLoading

  window.__turnstileScriptLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    )
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Turnstile load failed")))
      return
    }
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Turnstile load failed"))
    document.head.appendChild(script)
  })
  return window.__turnstileScriptLoading
}

type TurnstileFieldProps = {
  /** When omitted, reads NEXT_PUBLIC_TURNSTILE_SITE_KEY from env at build time. */
  siteKey?: string | null
  className?: string
}

/**
 * Renders Cloudflare Turnstile when a site key is configured.
 * Submits token as `cf-turnstile-response` with the parent form.
 */
export const TurnstileField = ({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null,
  className,
}: TurnstileFieldProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const reactId = useId()

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false

    const mount = async () => {
      try {
        await loadTurnstileScript()
        if (cancelled || !containerRef.current || !window.turnstile) return
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
        })
      } catch {
        /* Widget optional when script blocked; server will reject if secret set */
      }
    }
    void mount()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, reactId])

  if (!siteKey) return null

  return (
    <div className={className} data-testid="turnstile-field">
      <div ref={containerRef} />
    </div>
  )
}

/**
 * Execute an invisible Turnstile challenge and return a token (for XHR uploads).
 * Returns null when site key is not configured.
 */
export const getTurnstileTokenForUpload = async (): Promise<string | null> => {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  if (!siteKey || typeof window === "undefined") return null

  await loadTurnstileScript()
  if (!window.turnstile) return null

  const turnstile = window.turnstile

  return new Promise((resolve) => {
    const host = document.createElement("div")
    host.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"
    document.body.appendChild(host)
    let settled = false
    const finish = (token: string | null) => {
      if (settled) return
      settled = true
      try {
        turnstile.remove(widgetId)
      } catch {
        /* ignore */
      }
      host.remove()
      resolve(token)
    }
    const widgetId = turnstile.render(host, {
      sitekey: siteKey,
      theme: "dark",
      callback: (token) => finish(token),
      "expired-callback": () => finish(null),
      "error-callback": () => finish(null),
    })
    window.setTimeout(() => finish(null), 15_000)
  })
}

export default TurnstileField
