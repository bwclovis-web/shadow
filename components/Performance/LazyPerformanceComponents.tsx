import { lazy, Suspense } from "react"

// Lazy load performance components
const PerformanceDashboard = lazy(() => import("~/components/Organisms/PerformanceDashboard"))
const PerformanceAlerts = lazy(() => import("~/components/Organisms/PerformanceAlerts"))
const PerformanceOptimizer = lazy(() => import("~/components/Organisms/PerformanceOptimizer"))
const PerformanceTracer = lazy(() => import("~/components/Organisms/PerformanceTracer"))

// Loading fallback
const PerformanceLoading = () => (
  <div className="p-4 text-center text-gray-500">
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
    </div>
    <p className="mt-2 text-sm">Loading performance tools...</p>
  </div>
)

// Lazy performance components wrapper
export const LazyPerformanceComponents = () => (
  <Suspense fallback={<PerformanceLoading />}>
    <div className="space-y-6">
      <PerformanceDashboard />
      <PerformanceAlerts />
      <PerformanceOptimizer />
      <PerformanceTracer />
    </div>
  </Suspense>
)

export default LazyPerformanceComponents
