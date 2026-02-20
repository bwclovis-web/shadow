import { useEffect } from "react"

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    // Guard: Only run on client side
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return
    }

    if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
      return
    }

    // Lazy load service worker after user interaction or idle time
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                if (confirm("A new version is available! Reload to update?")) {
                  window.location.reload()
                }
              }
            })
          }
        })
      } catch (error) {
        console.error("Service Worker registration failed:", error)
      }
    }

    // Register service worker on first user interaction
    const handleFirstInteraction = () => {
      registerServiceWorker()
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("scroll", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
    }

    // Register on user interaction
    document.addEventListener("click", handleFirstInteraction)
    document.addEventListener("scroll", handleFirstInteraction)
    document.addEventListener("keydown", handleFirstInteraction)

    // Fallback: register after idle time or 5 seconds
    const registerWhenIdle = () => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          registerServiceWorker()
        })
      } else {
        setTimeout(() => {
          registerServiceWorker()
        }, 2000)
      }
    }

    // Fallback registration
    setTimeout(registerWhenIdle, 5000)

    // Handle offline/online events
    const handleOnline = () => {
      document.body.classList.remove("offline")
    }

    const handleOffline = () => {
      document.body.classList.add("offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check initial online status
    if (!navigator.onLine) {
      handleOffline()
    }

    return () => {
      document.removeEventListener("click", handleFirstInteraction)
      document.removeEventListener("scroll", handleFirstInteraction)
      document.removeEventListener("keydown", handleFirstInteraction)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return null
}

export default ServiceWorkerRegistration
