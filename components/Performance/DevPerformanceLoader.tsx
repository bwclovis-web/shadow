import { lazy, Suspense, useEffect, useState } from "react"

const LazyPerformanceComponents = lazy(() => import("~/components/Performance/LazyPerformanceComponents"))

export interface DevPerformanceLoaderProps {
  enabled?: boolean
}

export const DevPerformanceLoader = ({
  enabled = true,
}: DevPerformanceLoaderProps) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Only load in development and on client side
  if (process.env.NODE_ENV !== "development" || !enabled || !isClient) {
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
          <p className="mt-2 text-sm">Loading dev tools...</p>
        </div>
      }
    >
      <LazyPerformanceComponents />
    </Suspense>
  )
}

export default DevPerformanceLoader
