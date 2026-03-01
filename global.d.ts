/// <reference types="next" />

declare global {
  interface ImportMeta {
    env?: Record<string, string | undefined>
  }
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export {}
