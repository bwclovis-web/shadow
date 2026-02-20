import { type ReactNode, useEffect, useState } from "react"

/**
 * ClientOnly component that only renders its children on the client side.
 * Useful for components that use browser-only APIs or cause SSR mismatches.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return null
  }

  return <>{children}</>
}

