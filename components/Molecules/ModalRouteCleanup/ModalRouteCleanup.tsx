"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { useSessionStore } from "@/hooks/sessionStore"

/**
 * Closes the global session modal when the route changes so body scroll lock
 * and modal state do not leak after in-modal navigation (e.g. profile links).
 */
const ModalRouteCleanup = () => {
  const pathname = usePathname()
  const closeModal = useSessionStore(state => state.closeModal)
  const previousPathRef = useRef(pathname)

  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      const { modalOpen } = useSessionStore.getState()
      if (modalOpen) {
        closeModal()
      }
    }
    previousPathRef.current = pathname
  }, [pathname, closeModal])

  return null
}

export default ModalRouteCleanup
