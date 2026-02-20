import React, { ComponentType, lazy, Suspense } from "react"

import { styleMerge } from "~/utils/styleUtils"

interface LazyRouteProps {
  importFn: () => Promise<{ default: ComponentType<any> }>
  fallback?: React.ReactNode
  className?: string
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
)

const LazyRoute: React.FC<LazyRouteProps> = ({
  importFn,
  fallback = <DefaultFallback />,
  className,
}) => {
  const LazyComponent = lazy(importFn)

  return (
    <div className={styleMerge("w-full", className)}>
      <Suspense fallback={fallback}>
        <LazyComponent />
      </Suspense>
    </div>
  )
}

export default LazyRoute
