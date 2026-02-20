import { lazy, Suspense, useEffect, useState } from "react"

const LazyPerformanceComponents = lazy(() => import("~/components/Performance/LazyPerformanceComponents"))

export interface ConditionalPerformanceLoaderProps {
  userRole?: string
  enabled?: boolean
}

export const ConditionalPerformanceLoader = ({
  userRole,
  enabled = true,
}: ConditionalPerformanceLoaderProps) => {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Only load performance components for admins or when explicitly enabled
    if (
      isClient &&
      enabled &&
      (userRole === "admin" || process.env.NODE_ENV === "development")
    ) {
      setShouldLoad(true)
    }
  }, [userRole, enabled, isClient])

  if (!shouldLoad || !isClient) {
    return null
  }

  return (
    <Suspense
      fallback={
        <div className="p-4 text-center text-gray-500">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="mt-2 text-sm">Loading performance tools...</p>
        </div>
      }
    >
      <LazyPerformanceComponents />
    </Suspense>
  )
}

export default ConditionalPerformanceLoader
